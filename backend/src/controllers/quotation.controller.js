const prisma = require("../config/db");
const { generateNumber } = require("../utils/genNumber");
const { computeLineAmount, computeGrandTotal } = require("../utils/calc");

async function createQuotation(req, res) {
  const { enquiryId, validUntil, items } = req.body;

  if (!enquiryId) return res.status(400).json({ error: "enquiryId is required" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one product line item is required" });
  }
  for (const it of items) {
    if (!it.productId || !Number.isInteger(it.quantity) || it.quantity <= 0 || it.unitPrice == null) {
      return res.status(400).json({ error: "Each item needs productId, positive integer quantity, and unitPrice" });
    }
  }

  try {
    const enquiry = await prisma.enquiry.findUnique({ where: { id: enquiryId } });
    if (!enquiry) return res.status(404).json({ error: "Enquiry not found" });

    // Backend computes every line amount and the grand total. Any "amount" sent by the
    // client is ignored entirely -- only quantity/unitPrice/discountPct/gstPct are trusted.
    const computedItems = items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountPct: it.discountPct || 0,
      gstPct: it.gstPct || 0,
      lineAmount: computeLineAmount(it),
    }));
    const grandTotal = computeGrandTotal(items);

    const quotation = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.create({
        data: {
          quotationNumber: generateNumber("QUO"),
          enquiryId,
          customerId: enquiry.customerId,
          createdById: req.user.id,
          validUntil: validUntil ? new Date(validUntil) : null,
          grandTotal,
          status: "DRAFT",
          items: { create: computedItems },
        },
        include: { items: { include: { product: true } } },
      });

      await tx.enquiry.update({ where: { id: enquiryId }, data: { status: "QUOTED" } });

      return q;
    });

    return res.status(201).json(quotation);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create quotation" });
  }
}

async function listQuotations(req, res) {
  const quotations = await prisma.quotation.findMany({
    include: {
      customer: true,
      items: { include: { product: true } },
      enquiry: { select: { id: true, enquiryNumber: true } },
      salesOrder: { select: { id: true, orderNumber: true } },
    },
    orderBy: { id: "desc" },
  });
  return res.json(quotations);
}

async function getQuotation(req, res) {
  const id = Number(req.params.id);
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: true, enquiry: true },
  });
  if (!quotation) return res.status(404).json({ error: "Quotation not found" });
  return res.json(quotation);
}

// PATCH /quotations/:id/status  { status: "SENT" | "ACCEPTED" | "REJECTED" }
const ALLOWED_TRANSITIONS = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
};

async function updateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!["DRAFT", "SENT", "ACCEPTED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) return res.status(404).json({ error: "Quotation not found" });

  const allowed = ALLOWED_TRANSITIONS[quotation.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({
      error: `Cannot transition quotation from ${quotation.status} to ${status}`,
    });
  }

  const updated = await prisma.quotation.update({ where: { id }, data: { status } });

  if (status === "ACCEPTED") {
    await prisma.enquiry.update({ where: { id: quotation.enquiryId }, data: { status: "WON" } });
  } else if (status === "REJECTED") {
    await prisma.enquiry.update({ where: { id: quotation.enquiryId }, data: { status: "LOST" } });
  }

  return res.json(updated);
}

// POST /quotations/:id/convert -> creates a Sales Order
async function convertToSalesOrder(req, res) {
  const id = Number(req.params.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id },
        include: { items: true, salesOrder: true },
      });

      if (!quotation) {
        const e = new Error("NOT_FOUND");
        throw e;
      }
      if (quotation.status !== "ACCEPTED") {
        const e = new Error("NOT_ACCEPTED");
        throw e;
      }
      if (quotation.salesOrder) {
        // Unique constraint on quotationId also guards this at the DB level.
        const e = new Error("ALREADY_CONVERTED");
        throw e;
      }

      const order = await tx.salesOrder.create({
        data: {
          orderNumber: generateNumber("SO"),
          quotationId: quotation.id,
          customerId: quotation.customerId,
          totalAmount: quotation.grandTotal,
          status: "PENDING",
          items: {
            create: quotation.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      return order;
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Quotation not found" });
    if (err.message === "NOT_ACCEPTED") return res.status(400).json({ error: "Only an ACCEPTED quotation can be converted to a Sales Order" });
    if (err.message === "ALREADY_CONVERTED") return res.status(409).json({ error: "This quotation has already generated a Sales Order" });
    // Unique constraint race: two simultaneous convert calls
    if (err.code === "P2002") return res.status(409).json({ error: "This quotation has already generated a Sales Order" });
    console.error(err);
    return res.status(500).json({ error: "Failed to convert quotation" });
  }
}

module.exports = { createQuotation, listQuotations, getQuotation, updateStatus, convertToSalesOrder };
