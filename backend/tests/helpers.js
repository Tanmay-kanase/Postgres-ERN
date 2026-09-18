const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/db");

async function loginAs(role) {
  const email = role === "ADMIN" ? "admin@erp.com" : "sales@erp.com";
  const password = role === "ADMIN" ? "Admin@123" : "Sales@123";
  const res = await request(app).post("/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

async function getAnyProduct() {
  const product = await prisma.product.findFirst({ orderBy: { id: "asc" } });
  return product;
}

/**
 * Full happy-path builder: enquiry -> quotation -> ACCEPTED, returns the quotation.
 * Uses the given product at the given quantity/unitPrice.
 */
async function buildAcceptedQuotation(salesToken, { productId, quantity, unitPrice }) {
  const enquiryRes = await request(app)
    .post("/enquiries")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      customer: {
        companyName: "Test Co " + Date.now(),
        contactPerson: "Tester",
        mobile: "9" + Math.floor(Math.random() * 1000000000),
      },
      items: [{ productId, quantity }],
    });

  const quotationRes = await request(app)
    .post("/quotations")
    .set("Authorization", `Bearer ${salesToken}`)
    .send({
      enquiryId: enquiryRes.body.id,
      items: [{ productId, quantity, unitPrice, discountPct: 0, gstPct: 18 }],
    });

  await request(app)
    .patch(`/quotations/${quotationRes.body.id}/status`)
    .set("Authorization", `Bearer ${salesToken}`)
    .send({ status: "SENT" });

  const acceptedRes = await request(app)
    .patch(`/quotations/${quotationRes.body.id}/status`)
    .set("Authorization", `Bearer ${salesToken}`)
    .send({ status: "ACCEPTED" });

  return acceptedRes.body;
}

module.exports = { loginAs, getAnyProduct, buildAcceptedQuotation };
