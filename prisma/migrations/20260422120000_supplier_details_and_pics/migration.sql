-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "phone" TEXT,
ADD COLUMN "address" TEXT;

-- CreateTable
CREATE TABLE "supplier_pics" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_pics_supplier_id_sort_order_idx" ON "supplier_pics"("supplier_id", "sort_order");

-- AddForeignKey
ALTER TABLE "supplier_pics" ADD CONSTRAINT "supplier_pics_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
