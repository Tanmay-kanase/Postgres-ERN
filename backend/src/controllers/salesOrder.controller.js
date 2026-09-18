const prisma = require("../config/db");

async function listSalesOrders(req, res) {
  const orders = await prisma.salesOrder.findMany({
    include: {
      customer: true,
      items: { include: { product: true } },
      quotation: { select: { id: true, quotationNumber: true } },
    },
    orderBy: { id: "desc" },
  });
  return res.json(orders);
}

async function getSalesOrder(req, res) {
  const id = Number(req.params.id);
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: true, dispatches: true },
  });
  if (!order) return res.status(404).json({ error: "Sales Order not found" });
  return res.json(order);
}

/**
 * POST /sales-orders/:id/confirm  (ADMIN only)
 *
 * Concurrency handling: two admins confirming orders that both draw on the same
 * product's stock must not both succeed if there isn't enough for both.
 *
 * We solve this with a single conditional UPDATE per line item, executed inside a
 * Postgres transaction:
 *
 *   UPDATE inventory
 *   SET reserved_quantity = reserved_quantity + :qty
 *   WHERE product_id = :productId
 *     AND (physical_quantity - reserved_quantity) >= :qty
 *
 * This is atomic at the row level: Postgres takes a row lock for the duration of the
 * UPDATE, so if two transactions target the same product_id simultaneously, the second
 * one physically waits for the first to commit/rollback before its WHERE clause is
 * evaluated against the now-updated row. There is no read-then-write gap for another
 * transaction to interleave into (which a "SELECT to check, then UPDATE" approach
 * would be vulnerable to). If affected rows === 0, we know availability was
 * insufficient at the instant of the update and we roll back the whole order
 * confirmation via a thrown error inside prisma.$transaction.
 */
async function confirmOrder(req, res) {
  const id = Number(req.params.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new Error("NOT_FOUND");
      if (order.status !== "PENDING") throw new Error("BAD_STATUS");

      for (const item of order.items) {
        const affected = await tx.$executeRaw`
          UPDATE inventory
          SET reserved_quantity = reserved_quantity + ${item.quantity}
          WHERE product_id = ${item.productId}
            AND (physical_quantity - reserved_quantity) >= ${item.quantity}
        `;
        if (affected === 0) {
          const err = new Error("INSUFFICIENT_STOCK");
          err.productId = item.productId;
          throw err;
        }
      }

      return tx.salesOrder.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: { items: { include: { product: true } } },
      });
    });

    return res.json(result);
  } catch (err) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Sales Order not found" });
    if (err.message === "BAD_STATUS") return res.status(400).json({ error: "Only a PENDING order can be confirmed" });
    if (err.message === "INSUFFICIENT_STOCK") {
      return res.status(409).json({
        error: `Insufficient available stock for product ${err.productId}`,
      });
    }
    console.error(err);
    return res.status(500).json({ error: "Failed to confirm order" });
  }
}

/**
 * POST /sales-orders/:id/cancel (ADMIN only)
 * Allowed from PENDING or CONFIRMED. If CONFIRMED, releases any reserved stock.
 */
async function cancelOrder(req, res) {
  const id = Number(req.params.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new Error("NOT_FOUND");
      if (!["PENDING", "CONFIRMED"].includes(order.status)) throw new Error("BAD_STATUS");

      if (order.status === "CONFIRMED") {
        for (const item of order.items) {
          const outstanding = item.quantity - item.dispatchedQuantity;
          if (outstanding > 0) {
            await tx.$executeRaw`
              UPDATE inventory
              SET reserved_quantity = reserved_quantity - ${outstanding}
              WHERE product_id = ${item.productId}
            `;
          }
        }
      }

      return tx.salesOrder.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: { items: { include: { product: true } } },
      });
    });

    return res.json(result);
  } catch (err) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Sales Order not found" });
    if (err.message === "BAD_STATUS") return res.status(400).json({ error: "Only a PENDING or CONFIRMED order can be cancelled" });
    console.error(err);
    return res.status(500).json({ error: "Failed to cancel order" });
  }
}

/**
 * POST /sales-orders/:id/dispatch (ADMIN only)
 * body: { vehicleNumber, driverName, items: [{ productId, quantity }] }
 *
 * On dispatch: physical -= qty AND reserved -= qty, atomically and only if enough
 * reserved stock exists for that line (also guards against dispatching more than was
 * reserved / duplicate dispatch of the same quantity, via the per-line dispatched
 * quantity tracked on sales_order_items).
 */
async function dispatchOrder(req, res) {
  const id = Number(req.params.id);
  const { vehicleNumber, driverName, items } = req.body;

  if (!vehicleNumber || !driverName) {
    return res.status(400).json({ error: "vehicleNumber and driverName are required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one dispatch line item is required" });
  }

  const { generateNumber } = require("../utils/genNumber");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new Error("NOT_FOUND");
      if (order.status === "CANCELLED") throw new Error("CANCELLED_ORDER");
      if (order.status !== "CONFIRMED") throw new Error("NOT_CONFIRMED");

      for (const reqItem of items) {
        const orderItem = order.items.find((oi) => oi.productId === reqItem.productId);
        if (!orderItem) throw new Error("ITEM_NOT_IN_ORDER");

        const remaining = orderItem.quantity - orderItem.dispatchedQuantity;
        if (reqItem.quantity > remaining) {
          const err = new Error("OVER_DISPATCH");
          err.productId = reqItem.productId;
          throw err;
        }

        // Atomically decrement physical & reserved, guarded so we never go negative
        // and never dispatch beyond what is actually reserved for this product.
        const affectedInv = await tx.$executeRaw`
          UPDATE inventory
          SET physical_quantity = physical_quantity - ${reqItem.quantity},
              reserved_quantity = reserved_quantity - ${reqItem.quantity}
          WHERE product_id = ${reqItem.productId}
            AND reserved_quantity >= ${reqItem.quantity}
            AND physical_quantity >= ${reqItem.quantity}
        `;
        if (affectedInv === 0) {
          const err = new Error("INSUFFICIENT_RESERVED");
          err.productId = reqItem.productId;
          throw err;
        }

        // Atomically bump dispatched_quantity, guarded against duplicate/over dispatch
        // even under concurrent dispatch requests for the same order line.
        const affectedLine = await tx.$executeRaw`
          UPDATE sales_order_items
          SET dispatched_quantity = dispatched_quantity + ${reqItem.quantity}
          WHERE id = ${orderItem.id}
            AND dispatched_quantity + ${reqItem.quantity} <= quantity
        `;
        if (affectedLine === 0) {
          const err = new Error("OVER_DISPATCH");
          err.productId = reqItem.productId;
          throw err;
        }
      }

      const dispatch = await tx.dispatch.create({
        data: {
          dispatchNumber: generateNumber("DSP"),
          salesOrderId: id,
          vehicleNumber,
          driverName,
          items: { create: items.map((it) => ({ productId: it.productId, quantity: it.quantity })) },
        },
        include: { items: { include: { product: true } } },
      });

      // If every line is now fully dispatched, mark the order DISPATCHED.
      const refreshedItems = await tx.salesOrderItem.findMany({ where: { salesOrderId: id } });
      const fullyDispatched = refreshedItems.every((it) => it.dispatchedQuantity >= it.quantity);
      if (fullyDispatched) {
        await tx.salesOrder.update({ where: { id }, data: { status: "DISPATCHED" } });
      }

      return dispatch;
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Sales Order not found" });
    if (err.message === "CANCELLED_ORDER") return res.status(400).json({ error: "Cannot dispatch a cancelled order" });
    if (err.message === "NOT_CONFIRMED") return res.status(400).json({ error: "Only a CONFIRMED order can be dispatched" });
    if (err.message === "ITEM_NOT_IN_ORDER") return res.status(400).json({ error: "Dispatch item does not belong to this order" });
    if (err.message === "OVER_DISPATCH") return res.status(409).json({ error: `Dispatch exceeds remaining quantity for product ${err.productId}` });
    if (err.message === "INSUFFICIENT_RESERVED") return res.status(409).json({ error: `Insufficient reserved stock for product ${err.productId}` });
    console.error(err);
    return res.status(500).json({ error: "Failed to process dispatch" });
  }
}

module.exports = { listSalesOrders, getSalesOrder, confirmOrder, cancelOrder, dispatchOrder };
