const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/db");
const { loginAs, getAnyProduct } = require("./helpers");

describe("Test 2: DRAFT / REJECTED quotation cannot create a Sales Order", () => {
  let salesToken;
  let product;

  beforeAll(async () => {
    salesToken = await loginAs("SALES_USER");
    product = await getAnyProduct();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("DRAFT quotation is rejected on convert", async () => {
    const enquiryRes = await request(app)
      .post("/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customer: { companyName: "Draft Test Co", contactPerson: "T", mobile: "9" + Date.now() },
        items: [{ productId: product.id, quantity: 2 }],
      });

    const quotationRes = await request(app)
      .post("/quotations")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        enquiryId: enquiryRes.body.id,
        items: [{ productId: product.id, quantity: 2, unitPrice: 100 }],
      });

    expect(quotationRes.body.status).toBe("DRAFT");

    const convertRes = await request(app)
      .post(`/quotations/${quotationRes.body.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    expect(convertRes.status).toBe(400);
  });

  test("REJECTED quotation is rejected on convert", async () => {
    const enquiryRes = await request(app)
      .post("/enquiries")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        customer: { companyName: "Reject Test Co", contactPerson: "T", mobile: "9" + (Date.now() + 1) },
        items: [{ productId: product.id, quantity: 2 }],
      });

    const quotationRes = await request(app)
      .post("/quotations")
      .set("Authorization", `Bearer ${salesToken}`)
      .send({
        enquiryId: enquiryRes.body.id,
        items: [{ productId: product.id, quantity: 2, unitPrice: 100 }],
      });

    await request(app)
      .patch(`/quotations/${quotationRes.body.id}/status`)
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ status: "SENT" });

    await request(app)
      .patch(`/quotations/${quotationRes.body.id}/status`)
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ status: "REJECTED" });

    const convertRes = await request(app)
      .post(`/quotations/${quotationRes.body.id}/convert`)
      .set("Authorization", `Bearer ${salesToken}`);

    expect(convertRes.status).toBe(400);
  });
});
