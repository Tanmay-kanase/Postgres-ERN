const express = require("express");
const {
  listSalesOrders,
  getSalesOrder,
  confirmOrder,
  cancelOrder,
  dispatchOrder,
} = require("../controllers/salesOrder.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");

const router = express.Router();

router.get("/", authenticate, listSalesOrders); // Admin + Sales
router.get("/:id", authenticate, getSalesOrder);
router.post("/:id/confirm", authenticate, requireRole("ADMIN"), confirmOrder);
router.post("/:id/cancel", authenticate, requireRole("ADMIN"), cancelOrder);
router.post("/:id/dispatch", authenticate, requireRole("ADMIN"), dispatchOrder);

module.exports = router;
