-- Add lot/batch traceability columns
ALTER TABLE "material_transformations"
  ADD COLUMN "output_lot_no" TEXT,
  ADD COLUMN "output_batch_no" TEXT;

ALTER TABLE "material_transformation_inputs"
  ADD COLUMN "lot_no" TEXT,
  ADD COLUMN "batch_no" TEXT;

ALTER TABLE "inbound_receipts"
  ADD COLUMN "lot_no" TEXT,
  ADD COLUMN "batch_no" TEXT,
  ADD COLUMN "expiry_date" TIMESTAMP(3);
