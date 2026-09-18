const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash("Admin@123", 10);
  const salesPasswordHash = await bcrypt.hash("Sales@123", 10);

  await prisma.user.upsert({
    where: { email: "admin@erp.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@erp.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "sales@erp.com" },
    update: {},
    create: {
      name: "Sales User",
      email: "sales@erp.com",
      passwordHash: salesPasswordHash,
      role: "SALES_USER",
    },
  });

  const products = [
    { code: "IP-001", name: "Industrial Bearing 6205", category: "Bearings", unit: "PCS", basePrice: 350.0, physical: 500 },
    { code: "IP-002", name: "Hydraulic Hose 1/2in", category: "Hydraulics", unit: "MTR", basePrice: 120.0, physical: 800 },
    { code: "IP-003", name: "Stainless Steel Valve 2in", category: "Valves", unit: "PCS", basePrice: 2200.0, physical: 150 },
    { code: "IP-004", name: "Industrial Motor 5HP", category: "Motors", unit: "PCS", basePrice: 18500.0, physical: 40 },
    { code: "IP-005", name: "Conveyor Belt Roller", category: "Conveyor Parts", unit: "PCS", basePrice: 950.0, physical: 200 },
    { code: "IP-006", name: "Pressure Gauge 0-10 Bar", category: "Instrumentation", unit: "PCS", basePrice: 480.0, physical: 300 },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.unit,
        basePrice: p.basePrice,
      },
    });

    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {},
      create: {
        productId: product.id,
        physicalQuantity: p.physical,
        reservedQuantity: 0,
      },
    });
  }

  console.log("Seed complete.");
  console.log("Login credentials:");
  console.log("  Admin -> admin@erp.com / Admin@123");
  console.log("  Sales -> sales@erp.com / Sales@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
