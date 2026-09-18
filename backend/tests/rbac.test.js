const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/db");
const { loginAs, getAnyProduct, buildAcceptedQuotation } = require("./helpers");

describe("Test 5: RBAC - unauthorized users cannot perform restricted operations", () => {
  let salesToken, adminToken, product;

  beforeAll(async () => {
    salesToken = await loginAs("SALES_USER");
    adminToken = await loginAs("ADMIN");
    product = await getAnyProduct();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("a SALES_USER cannot confirm a Sales Order (Admin-only action)", async () => {
    const quotation = await buildAcceptedQuotation(salesToken, {
      productId: product.id,
      quantity: 1,
      unitPrice: 100,
    });
    const orderRes = await request(app)
      .post(`/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    const confirmAsSales = await request(app)
      .post(`/sales-orders/${orderRes.body.id}/confirm`)
      .set("Authorization", `Bearer ${salesToken}`);

    expect(confirmAsSales.status).toBe(403);
  });

  test("an ADMIN cannot create an enquiry (Sales-only action)", async () => {
    const res = await request(app)
      .post("/enquiries")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        customer: { companyName: "Admin Test", contactPerson: "T", mobile: "911" },
        items: [{ productId: product.id, quantity: 1 }],
      });

    expect(res.status).toBe(403);
  });

  test("a request with no token is rejected", async () => {
    const res = await request(app).get("/enquiries");
    expect(res.status).toBe(401);
  });

  test("a request with an invalid token is rejected", async () => {
    const res = await request(app).get("/enquiries").set("Authorization", "Bearer garbage.token.here");
    expect(res.status).toBe(401);
  });
});
