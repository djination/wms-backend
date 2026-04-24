CREATE TABLE "warehouse_customers" (
  "id" TEXT NOT NULL,
  "warehouse_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouse_customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouse_customers_warehouse_id_customer_id_key"
  ON "warehouse_customers"("warehouse_id", "customer_id");

CREATE INDEX "warehouse_customers_warehouse_id_is_active_idx"
  ON "warehouse_customers"("warehouse_id", "is_active");

CREATE INDEX "warehouse_customers_customer_id_is_active_idx"
  ON "warehouse_customers"("customer_id", "is_active");

ALTER TABLE "warehouse_customers"
  ADD CONSTRAINT "warehouse_customers_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warehouse_customers"
  ADD CONSTRAINT "warehouse_customers_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
