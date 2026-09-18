const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/db");
const { loginAs, buildAcceptedQuotation } = require("./helpers");

describe("Bonus: simultaneous inventory reservations", () => {
  let salesToken, adminToken, product;

  beforeAll(async () => {
    salesToken = await loginAs("SALES_USER");
    adminToken = await loginAs("ADMIN");

    product = await prisma.product.create({
      data: { code: "TEST-CONC-" + Date.now(), name: "Concurrency Test Product", category: "Test", unit: "PCS", basePrice: 10 },
    });
    // Available = 100. Two requests: reserve 80 and reserve 50. Both cannot succeed.
    await prisma.inventory.create({
      data: { productId: product.id, physicalQuantity: 100, reservedQuantity: 0 },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("only one of two conflicting concurrent confirmations succeeds", async () => {
    const quotationA = await buildAcceptedQuotation(salesToken, { productId: product.id, quantity: 80, unitPrice: 10 });
    const quotationB = await buildAcceptedQuotation(salesToken, { productId: product.id, quantity: 50, unitPrice: 10 });

    const orderA = await request(app).post(`/quotations/${quotationA.id}/convert`).set("Authorization", `Bearer ${salesToken}`);
    const orderB = await request(app).post(`/quotations/${quotationB.id}/convert`).set("Authorization", `Bearer ${salesToken}`);

    const [confirmA, confirmB] = await Promise.all([
      request(app).post(`/sales-orders/${orderA.body.id}/confirm`).set("Authorization", `Bearer ${adminToken}`),
      request(app).post(`/sales-orders/${orderB.body.id}/confirm`).set("Authorization", `Bearer ${adminToken}`),
    ]);

    const statuses = [confirmA.status, confirmB.status].sort();
    // Exactly one succeeds (200); the other is rejected for insufficient stock (409).
    expect(statuses).toEqual([200, 409]);

    const inv = await prisma.inventory.findUnique({ where: { productId: product.id } });
    // Reserved quantity must never exceed physical (100) and must equal exactly the
    // winning request's quantity (either 80 or 50) -- never both, never neither.
    expect([80, 50]).toContain(inv.reservedQuantity);
    expect(inv.reservedQuantity).toBeLessThanOrEqual(inv.physicalQuantity);
  });
});
