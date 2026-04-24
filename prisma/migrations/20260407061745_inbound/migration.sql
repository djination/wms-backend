-- CreateEnum
CREATE TYPE "InboundAsnStatus" AS ENUM ('DRAFT', 'RECEIVING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "inbound_asns" (
    "id" TEXT NOT NULL,
    "asn_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "reference_no" TEXT,
    "status" "InboundAsnStatus" NOT NULL DEFAULT 'DRAFT',
    "expected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_asns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_asn_items" (
    "id" TEXT NOT NULL,
    "inbound_asn_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_expected" DECIMAL(18,4) NOT NULL,
    "qty_received" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_asn_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_receipts" (
    "id" TEXT NOT NULL,
    "inbound_asn_id" TEXT NOT NULL,
    "inbound_item_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_received" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_asns_asn_no_key" ON "inbound_asns"("asn_no");

-- CreateIndex
CREATE INDEX "inbound_asns_customer_id_idx" ON "inbound_asns"("customer_id");

-- CreateIndex
CREATE INDEX "inbound_asns_warehouse_id_idx" ON "inbound_asns"("warehouse_id");

-- CreateIndex
CREATE INDEX "inbound_asns_status_idx" ON "inbound_asns"("status");

-- CreateIndex
CREATE INDEX "inbound_asn_items_product_id_idx" ON "inbound_asn_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_asn_items_inbound_asn_id_product_id_key" ON "inbound_asn_items"("inbound_asn_id", "product_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_inbound_asn_id_idx" ON "inbound_receipts"("inbound_asn_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_customer_id_idx" ON "inbound_receipts"("customer_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_warehouse_id_idx" ON "inbound_receipts"("warehouse_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_bin_id_idx" ON "inbound_receipts"("bin_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_product_id_idx" ON "inbound_receipts"("product_id");

-- AddForeignKey
ALTER TABLE "inbound_asns" ADD CONSTRAINT "inbound_asns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_asns" ADD CONSTRAINT "inbound_asns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_asn_items" ADD CONSTRAINT "inbound_asn_items_inbound_asn_id_fkey" FOREIGN KEY ("inbound_asn_id") REFERENCES "inbound_asns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_asn_items" ADD CONSTRAINT "inbound_asn_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_inbound_asn_id_fkey" FOREIGN KEY ("inbound_asn_id") REFERENCES "inbound_asns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_inbound_item_id_fkey" FOREIGN KEY ("inbound_item_id") REFERENCES "inbound_asn_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
