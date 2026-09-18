const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/db");
const { loginAs, getAnyProduct, buildAcceptedQuotation } = require("./helpers");

describe("Test 3: one quotation cannot generate more than one Sales Order", () => {
  let salesToken;
  let product;

  beforeAll(async () => {
    salesToken = await loginAs("SALES_USER");
    product = await getAnyProduct();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("second convert attempt on the same quotation is rejected", async () => {
    const quotation = await buildAcceptedQuotation(salesToken, {
      productId: product.id,
      quantity: 1,
      unitPrice: 100,
    });
    expect(quotation.status).toBe("ACCEPTED");

    const first = await request(app)
      .post(`/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/quotations/${quotation.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);
    expect([400, 409]).toContain(second.status);
  });

  test("two simultaneous convert calls on the same quotation only succeed once", async () => {
    const quotation = await buildAcceptedQuotation(salesToken, {
      productId: product.id,
      quantity: 1,
      unitPrice: 100,
    });

    const [r1, r2] = await Promise.all([
      request(app).post(`/quotations/${quotation.id}/convert`).set("Authorization", `Bearer ${salesToken}`),
      request(app).post(`/quotations/${quotation.id}/convert`).set("Authorization", `Bearer ${salesToken}`),
    ]);

    const successes = [r1, r2].filter((r) => r.status === 201);
    expect(successes.length).toBe(1);
  });
});
