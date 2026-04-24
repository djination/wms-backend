-- AlterTable
ALTER TABLE "users" ADD COLUMN "operator_company_id" TEXT;

-- CreateTable
CREATE TABLE "user_warehouses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_warehouses_user_id_warehouse_id_key" ON "user_warehouses"("user_id", "warehouse_id");
CREATE INDEX "user_warehouses_warehouse_id_idx" ON "user_warehouses"("warehouse_id");
CREATE INDEX "users_operator_company_id_idx" ON "users"("operator_company_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_operator_company_id_fkey" FOREIGN KEY ("operator_company_id") REFERENCES "operator_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
