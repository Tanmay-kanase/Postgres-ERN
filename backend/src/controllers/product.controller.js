const prisma = require("../config/db");

async function listProducts(req, res) {
  const products = await prisma.product.findMany({
    include: { inventory: true },
    orderBy: { id: "asc" },
  });

  const withAvailability = products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    unit: p.unit,
    basePrice: p.basePrice,
    physicalQuantity: p.inventory?.physicalQuantity ?? 0,
    reservedQuantity: p.inventory?.reservedQuantity ?? 0,
    availableQuantity: (p.inventory?.physicalQuantity ?? 0) - (p.inventory?.reservedQuantity ?? 0),
  }));

  return res.json(withAvailability);
}

// ADMIN-only: adjust physical stock (e.g. new stock received). Never touches reserved.
async function adjustPhysicalStock(req, res) {
  const productId = Number(req.params.id);
  const { delta } = req.body; // positive or negative integer

  if (!Number.isInteger(delta)) {
    return res.status(400).json({ error: "delta must be an integer" });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { productId } });
      if (!inv) throw new Error("NOT_FOUND");

      const newPhysical = inv.physicalQuantity + delta;
      if (newPhysical < 0) throw new Error("NEGATIVE");
      if (newPhysical < inv.reservedQuantity) throw new Error("BELOW_RESERVED");

      return tx.inventory.update({
        where: { productId },
        data: { physicalQuantity: newPhysical },
      });
    });

    return res.json(updated);
  } catch (err) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Product/inventory not found" });
    if (err.message === "NEGATIVE") return res.status(400).json({ error: "Resulting physical quantity cannot be negative" });
    if (err.message === "BELOW_RESERVED") return res.status(400).json({ error: "Physical quantity cannot drop below already-reserved quantity" });
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { listProducts, adjustPhysicalStock };
