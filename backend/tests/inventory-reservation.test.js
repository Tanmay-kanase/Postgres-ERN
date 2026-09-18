const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/db");
const { loginAs, buildAcceptedQuotation } = require("./helpers");

describe("Test 4: cannot reserve more than available inventory", () => {
  let salesToken, adminToken, product;

  beforeAll(async () => {
    salesToken = await loginAs("SALES_USER");
    adminToken = await loginAs("ADMIN");

    // Isolated product with a small, known stock level so this test is deterministic
    // regardless of what other tests have reserved elsewhere.
    product = await prisma.product.create({
      data: { code: "TEST-INV-" + Date.now(), name: "Test Product", category: "Test", unit: "PCS", basePrice: 10 },
    });
    await prisma.inventory.create({
      data: { productId: product.id, physicalQuantity: 50, reservedQuantity: 0 },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("confirming an order that exceeds available stock is rejected and reserved stays unchanged", async () => {
    const quotation = await buildAcceptedQuotation(salesToken, {
      productId: product.id,
      quantity: 999, // far beyond the 50 physical units available
      unitPrice: 10,
    });

    const orderRes = await request(app)
      .post(`/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);
    expect(orderRes.status).toBe(201);

    const confirmRes = await request(app)
      .post(`/sales-orders/${orderRes.body.id}/confirm`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(confirmRes.status).toBe(409);

    const inv = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inv.reservedQuantity).toBe(0);
  });

  test("confirming an order within available stock succeeds and reserves correctly", async () => {
    const quotation = await buildAcceptedQuotation(salesToken, {
      productId: product.id,
      quantity: 20,
      unitPrice: 10,
    });

    const orderRes = await request(app)
      .post(`/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    const confirmRes = await request(app)
      .post(`/sales-orders/${orderRes.body.id}/confirm`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(confirmRes.status).toBe(200);

    const inv = await prisma.inventory.findUnique({ where: { productId: product.id } });
    expect(inv.reservedQuantity).toBe(20);
    expect(inv.physicalQuantity - inv.reservedQuantity).toBe(30);
  });
});
