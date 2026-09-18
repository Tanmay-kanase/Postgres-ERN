const express = require("express");
const { listProducts, adjustPhysicalStock } = require("../controllers/product.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");

const router = express.Router();

// Both roles may view inventory availability
router.get("/", authenticate, listProducts);

// Only Admin manages inventory
router.patch("/:id/stock", authenticate, requireRole("ADMIN"), adjustPhysicalStock);

module.exports = router;
