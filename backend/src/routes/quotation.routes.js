const express = require("express");
const {
  createQuotation,
  listQuotations,
  getQuotation,
  updateStatus,
  convertToSalesOrder,
} = require("../controllers/quotation.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");

const router = express.Router();

router.get("/", authenticate, listQuotations);
router.get("/:id", authenticate, getQuotation);
router.post("/", authenticate, requireRole("SALES_USER"), createQuotation);
router.patch("/:id/status", authenticate, requireRole("SALES_USER"), updateStatus);
router.post("/:id/convert", authenticate, requireRole("SALES_USER"), convertToSalesOrder);

module.exports = router;
