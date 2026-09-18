const prisma = require("../config/db");
const { generateNumber } = require("../utils/genNumber");

async function createEnquiry(req, res) {
  const { customer, enquiryDate, requiredDate, notes, items } = req.body;

  if (!customer || !customer.companyName || !customer.contactPerson || !customer.mobile) {
    return res.status(400).json({ error: "customer.companyName, contactPerson and mobile are required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one product line item is required" });
  }
  for (const it of items) {
    if (!it.productId || !Number.isInteger(it.quantity) || it.quantity <= 0) {
      return res.status(400).json({ error: "Each item needs a valid productId and a positive integer quantity" });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Reuse existing customer by mobile if present, otherwise create.
      let cust = await tx.customer.findFirst({ where: { mobile: customer.mobile } });
      if (!cust) {
        cust = await tx.customer.create({
          data: {
            companyName: customer.companyName,
            contactPerson: customer.contactPerson,
            mobile: customer.mobile,
            email: customer.email || null,
            city: customer.city || null,
          },
        });
      }

      const enquiry = await tx.enquiry.create({
        data: {
          enquiryNumber: generateNumber("ENQ"),
          customerId: cust.id,
          createdById: req.user.id,
          enquiryDate: enquiryDate ? new Date(enquiryDate) : new Date(),
          requiredDate: requiredDate ? new Date(requiredDate) : null,
          notes: notes || null,
          items: {
            create: items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
            })),
          },
        },
        include: { items: { include: { product: true } }, customer: true },
      });

      return enquiry;
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create enquiry" });
  }
}

async function listEnquiries(req, res) {
  const enquiries = await prisma.enquiry.findMany({
    include: {
      customer: true,
      items: { include: { product: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { id: "desc" },
  });
  return res.json(enquiries);
}

async function getEnquiry(req, res) {
  const id = Number(req.params.id);
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: true } },
      quotations: true,
    },
  });
  if (!enquiry) return res.status(404).json({ error: "Enquiry not found" });
  return res.json(enquiry);
}

module.exports = { createEnquiry, listEnquiries, getEnquiry };
