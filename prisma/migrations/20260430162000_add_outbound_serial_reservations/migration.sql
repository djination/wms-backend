-- Create enum for outbound serial reservation lifecycle
CREATE TYPE "OutboundSerialReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

-- Create table to pre-reserve serial numbers in planning phase
CREATE TABLE "outbound_serial_reservations" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "wave_id" TEXT,
    "outbound_task_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "serial_no" TEXT NOT NULL,
    "status" "OutboundSerialReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "release_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outbound_serial_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbound_serial_reservations_customer_id_product_id_serial_no_sta_key"
ON "outbound_serial_reservations"("customer_id", "product_id", "serial_no", "status");

CREATE INDEX "outbound_serial_reservations_sales_order_id_sales_order_item_id_idx"
ON "outbound_serial_reservations"("sales_order_id", "sales_order_item_id", "status");
CREATE INDEX "outbound_serial_reservations_wave_id_status_idx"
ON "outbound_serial_reservations"("wave_id", "status");
CREATE INDEX "outbound_serial_reservations_outbound_task_id_status_idx"
ON "outbound_serial_reservations"("outbound_task_id", "status");
CREATE INDEX "outbound_serial_reservations_warehouse_id_product_id_status_idx"
ON "outbound_serial_reservations"("warehouse_id", "product_id", "status");
CREATE INDEX "outbound_serial_reservations_customer_id_created_at_idx"
ON "outbound_serial_reservations"("customer_id", "created_at");

ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_sales_order_id_fkey"
FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_sales_order_item_id_fkey"
FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_wave_id_fkey"
FOREIGN KEY ("wave_id") REFERENCES "outbound_waves"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_outbound_task_id_fkey"
FOREIGN KEY ("outbound_task_id") REFERENCES "outbound_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_warehouse_id_fkey"
FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
