const express = require("express");
const { createEnquiry, listEnquiries, getEnquiry } = require("../controllers/enquiry.controller");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");

const router = express.Router();

router.get("/", authenticate, listEnquiries); // Admin + Sales can view
router.get("/:id", authenticate, getEnquiry);
router.post("/", authenticate, requireRole("SALES_USER"), createEnquiry); // only Sales creates

module.exports = router;
