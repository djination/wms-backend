-- CreateTable
CREATE TABLE "process_flow_event_logs" (
    "id" TEXT NOT NULL,
    "event_code" TEXT NOT NULL,
    "process_type" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "operator_company_id" TEXT,
    "internal_transfer_id" TEXT,
    "material_transformation_id" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_flow_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_flow_event_logs_customer_id_created_at_idx" ON "process_flow_event_logs"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "process_flow_event_logs_warehouse_id_created_at_idx" ON "process_flow_event_logs"("warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "process_flow_event_logs_internal_transfer_id_created_at_idx" ON "process_flow_event_logs"("internal_transfer_id", "created_at");

-- CreateIndex
CREATE INDEX "process_flow_event_logs_material_transformation_id_created_at_idx" ON "process_flow_event_logs"("material_transformation_id", "created_at");

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_operator_company_id_fkey" FOREIGN KEY ("operator_company_id") REFERENCES "operator_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_internal_transfer_id_fkey" FOREIGN KEY ("internal_transfer_id") REFERENCES "internal_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_material_transformation_id_fkey" FOREIGN KEY ("material_transformation_id") REFERENCES "material_transformations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
