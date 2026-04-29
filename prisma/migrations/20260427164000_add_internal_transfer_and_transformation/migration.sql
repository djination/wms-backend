-- CreateEnum
CREATE TYPE "InternalTransferStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialTransformationStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "internal_transfers" (
    "id" TEXT NOT NULL,
    "transfer_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "from_warehouse_id" TEXT NOT NULL,
    "to_warehouse_id" TEXT NOT NULL,
    "status" "InternalTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_transfer_lines" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source_bin_id" TEXT NOT NULL,
    "destination_bin_id" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_transformations" (
    "id" TEXT NOT NULL,
    "process_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "output_product_id" TEXT NOT NULL,
    "output_bin_id" TEXT NOT NULL,
    "qty_output" DECIMAL(18,4) NOT NULL,
    "status" "MaterialTransformationStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_transformations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_transformation_inputs" (
    "id" TEXT NOT NULL,
    "transformation_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "qty_consumed" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_transformation_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_transfers_transfer_no_key" ON "internal_transfers"("transfer_no");
CREATE INDEX "internal_transfers_customer_id_status_idx" ON "internal_transfers"("customer_id", "status");
CREATE INDEX "internal_transfers_from_warehouse_id_status_idx" ON "internal_transfers"("from_warehouse_id", "status");
CREATE INDEX "internal_transfers_to_warehouse_id_status_idx" ON "internal_transfers"("to_warehouse_id", "status");

-- CreateIndex
CREATE INDEX "internal_transfer_lines_transfer_id_idx" ON "internal_transfer_lines"("transfer_id");
CREATE INDEX "internal_transfer_lines_product_id_idx" ON "internal_transfer_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_transformations_process_no_key" ON "material_transformations"("process_no");
CREATE INDEX "material_transformations_customer_id_status_idx" ON "material_transformations"("customer_id", "status");
CREATE INDEX "material_transformations_warehouse_id_status_idx" ON "material_transformations"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "material_transformation_inputs_transformation_id_idx" ON "material_transformation_inputs"("transformation_id");
CREATE INDEX "material_transformation_inputs_product_id_idx" ON "material_transformation_inputs"("product_id");

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfer_lines" ADD CONSTRAINT "internal_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "internal_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_lines" ADD CONSTRAINT "internal_transfer_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_lines" ADD CONSTRAINT "internal_transfer_lines_source_bin_id_fkey" FOREIGN KEY ("source_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_lines" ADD CONSTRAINT "internal_transfer_lines_destination_bin_id_fkey" FOREIGN KEY ("destination_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_transformations" ADD CONSTRAINT "material_transformations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformations" ADD CONSTRAINT "material_transformations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformations" ADD CONSTRAINT "material_transformations_output_product_id_fkey" FOREIGN KEY ("output_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformations" ADD CONSTRAINT "material_transformations_output_bin_id_fkey" FOREIGN KEY ("output_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_transformation_inputs" ADD CONSTRAINT "material_transformation_inputs_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "material_transformations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformation_inputs" ADD CONSTRAINT "material_transformation_inputs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformation_inputs" ADD CONSTRAINT "material_transformation_inputs_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
