-- CreateTable
CREATE TABLE "warehouse_areas" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "area_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_bins" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouse_areas_warehouse_id_is_active_idx" ON "warehouse_areas"("warehouse_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_areas_warehouse_id_code_key" ON "warehouse_areas"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_zones_area_id_idx" ON "warehouse_zones"("area_id");

-- CreateIndex
CREATE INDEX "warehouse_zones_warehouse_id_is_active_idx" ON "warehouse_zones"("warehouse_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_zones_warehouse_id_code_key" ON "warehouse_zones"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_bins_zone_id_idx" ON "warehouse_bins"("zone_id");

-- CreateIndex
CREATE INDEX "warehouse_bins_warehouse_id_is_active_idx" ON "warehouse_bins"("warehouse_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_bins_warehouse_id_code_key" ON "warehouse_bins"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "products_customer_id_is_active_idx" ON "products"("customer_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "products_customer_id_sku_key" ON "products"("customer_id", "sku");

-- CreateIndex
CREATE INDEX "inventory_balances_warehouse_id_idx" ON "inventory_balances"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_balances_bin_id_idx" ON "inventory_balances"("bin_id");

-- CreateIndex
CREATE INDEX "inventory_balances_product_id_idx" ON "inventory_balances"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_customer_id_warehouse_id_bin_id_product__key" ON "inventory_balances"("customer_id", "warehouse_id", "bin_id", "product_id");

-- AddForeignKey
ALTER TABLE "warehouse_areas" ADD CONSTRAINT "warehouse_areas_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "warehouse_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
