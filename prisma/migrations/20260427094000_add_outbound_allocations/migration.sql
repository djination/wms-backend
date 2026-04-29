-- CreateTable
CREATE TABLE "outbound_allocations" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "qty_allocated" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_allocations_sales_order_id_sales_order_item_id_idx" ON "outbound_allocations"("sales_order_id", "sales_order_item_id");

-- CreateIndex
CREATE INDEX "outbound_allocations_warehouse_id_product_id_bin_id_idx" ON "outbound_allocations"("warehouse_id", "product_id", "bin_id");

-- CreateIndex
CREATE INDEX "outbound_allocations_customer_id_created_at_idx" ON "outbound_allocations"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
