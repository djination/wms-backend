-- AlterEnum
ALTER TYPE "SalesOrderStatus" ADD VALUE 'ALLOCATED';
ALTER TYPE "SalesOrderStatus" ADD VALUE 'LOADING';

-- CreateTable
CREATE TABLE "outbound_event_logs" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "outbound_task_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "operator_company_id" TEXT,
    "event_code" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_event_logs_sales_order_id_created_at_idx" ON "outbound_event_logs"("sales_order_id", "created_at");

-- CreateIndex
CREATE INDEX "outbound_event_logs_outbound_task_id_created_at_idx" ON "outbound_event_logs"("outbound_task_id", "created_at");

-- CreateIndex
CREATE INDEX "outbound_event_logs_warehouse_id_created_at_idx" ON "outbound_event_logs"("warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "outbound_event_logs_customer_id_created_at_idx" ON "outbound_event_logs"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_outbound_task_id_fkey" FOREIGN KEY ("outbound_task_id") REFERENCES "outbound_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_operator_company_id_fkey" FOREIGN KEY ("operator_company_id") REFERENCES "operator_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
