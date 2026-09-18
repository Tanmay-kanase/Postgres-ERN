-- Run this AFTER `npx prisma migrate dev` has created the tables.
-- Adds DB-level guarantees that Prisma's schema.prisma cannot express directly.
-- Usage: psql "$DATABASE_URL" -f prisma/extra_constraints.sql

ALTER TABLE inventory
  ADD CONSTRAINT chk_physical_nonneg CHECK (physical_quantity >= 0),
  ADD CONSTRAINT chk_reserved_nonneg CHECK (reserved_quantity >= 0),
  ADD CONSTRAINT chk_reserved_le_physical CHECK (reserved_quantity <= physical_quantity);

ALTER TABLE quotation_items
  ADD CONSTRAINT chk_qty_positive CHECK (quantity > 0),
  ADD CONSTRAINT chk_discount_range CHECK (discount_pct >= 0 AND discount_pct <= 100),
  ADD CONSTRAINT chk_gst_range CHECK (gst_pct >= 0 AND gst_pct <= 100);

ALTER TABLE enquiry_items
  ADD CONSTRAINT chk_enq_qty_positive CHECK (quantity > 0);

ALTER TABLE sales_order_items
  ADD CONSTRAINT chk_so_qty_positive CHECK (quantity > 0),
  ADD CONSTRAINT chk_dispatched_le_qty CHECK (dispatched_quantity <= quantity);

ALTER TABLE dispatch_items
  ADD CONSTRAINT chk_dispatch_qty_positive CHECK (quantity > 0);

-- Prevent a single quotation from generating more than one sales order
-- (already enforced via @unique on quotation_id in Prisma schema, restated here for clarity/documentation)
-- ALTER TABLE sales_orders ADD CONSTRAINT uq_quotation_id UNIQUE (quotation_id);
