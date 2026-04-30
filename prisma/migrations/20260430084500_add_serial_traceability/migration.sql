ALTER TABLE "material_transformations"
  ADD COLUMN "output_serial_nos" JSONB;

ALTER TABLE "material_transformation_inputs"
  ADD COLUMN "serial_nos" JSONB;

ALTER TABLE "inbound_receipts"
  ADD COLUMN "serial_nos" JSONB;
