-- AlterTable
ALTER TABLE "customers"
ADD COLUMN "phone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "subdistrict" TEXT,
ADD COLUMN "postal_code" TEXT;

-- AlterTable
ALTER TABLE "operator_companies"
ADD COLUMN "phone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "subdistrict" TEXT,
ADD COLUMN "postal_code" TEXT;

-- AlterTable
ALTER TABLE "suppliers"
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "subdistrict" TEXT,
ADD COLUMN "postal_code" TEXT;
