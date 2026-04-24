-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'PICKING', 'PACKING', 'SHIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboundTaskType" AS ENUM ('PICKING', 'PACKING', 'LOADING');

-- CreateEnum
CREATE TYPE "OutboundTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "consignee_name" TEXT,
    "reference_no" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "requested_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_ordered" DECIMAL(18,4) NOT NULL,
    "qty_picked" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qty_packed" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qty_shipped" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_waves" (
    "id" TEXT NOT NULL,
    "wave_no" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "planned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_waves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_tasks" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "wave_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source_bin_id" TEXT,
    "task_type" "OutboundTaskType" NOT NULL,
    "status" "OutboundTaskStatus" NOT NULL DEFAULT 'OPEN',
    "qty_task" DECIMAL(18,4) NOT NULL,
    "qty_done" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "assigned_to" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_order_no_key" ON "sales_orders"("order_no");

-- CreateIndex
CREATE INDEX "sales_orders_customer_id_status_idx" ON "sales_orders"("customer_id", "status");

-- CreateIndex
CREATE INDEX "sales_orders_warehouse_id_status_idx" ON "sales_orders"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_items_sales_order_id_product_id_key" ON "sales_order_items"("sales_order_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_waves_wave_no_key" ON "outbound_waves"("wave_no");

-- CreateIndex
CREATE INDEX "outbound_waves_sales_order_id_idx" ON "outbound_waves"("sales_order_id");

-- CreateIndex
CREATE INDEX "outbound_waves_warehouse_id_idx" ON "outbound_waves"("warehouse_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_sales_order_id_task_type_status_idx" ON "outbound_tasks"("sales_order_id", "task_type", "status");

-- CreateIndex
CREATE INDEX "outbound_tasks_sales_order_item_id_idx" ON "outbound_tasks"("sales_order_item_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_wave_id_idx" ON "outbound_tasks"("wave_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_warehouse_id_idx" ON "outbound_tasks"("warehouse_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_product_id_idx" ON "outbound_tasks"("product_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_source_bin_id_idx" ON "outbound_tasks"("source_bin_id");

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_waves" ADD CONSTRAINT "outbound_waves_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_waves" ADD CONSTRAINT "outbound_waves_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_wave_id_fkey" FOREIGN KEY ("wave_id") REFERENCES "outbound_waves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_source_bin_id_fkey" FOREIGN KEY ("source_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
