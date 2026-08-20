/*
  Warnings:

  - The values [ASSIGN_TO_DEPT] on the enum `OperationType` will be removed. If these variants are still used in the database, this will fail.
  - The values [ASSET,CONSUMABLE,SHARED] on the enum `ProductType` will be removed. If these variants are still used in the database, this will fail.
  - The values [PIECE,KG,LITER,PACK] on the enum `UnitType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `code` on the `Asset` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Assignment` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."OperationType_new" AS ENUM ('STOCK_IN', 'GIVE_TO_DEPT', 'RETURN_FROM_DEPT', 'GIVE_TO_USER', 'RETURN_FROM_USER', 'TRANSFER_USER', 'WRITE_OFF');
ALTER TABLE "public"."Operation" ALTER COLUMN "type" TYPE "public"."OperationType_new" USING ("type"::text::"public"."OperationType_new");
ALTER TYPE "public"."OperationType" RENAME TO "OperationType_old";
ALTER TYPE "public"."OperationType_new" RENAME TO "OperationType";
DROP TYPE "public"."OperationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ProductType_new" AS ENUM ('BERILADIGAN', 'SARFLANADIGAN');
ALTER TABLE "public"."Product" ALTER COLUMN "productType" TYPE "public"."ProductType_new" USING ("productType"::text::"public"."ProductType_new");
ALTER TYPE "public"."ProductType" RENAME TO "ProductType_old";
ALTER TYPE "public"."ProductType_new" RENAME TO "ProductType";
DROP TYPE "public"."ProductType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."UnitType_new" AS ENUM ('DONA', 'PACHKA', 'KOMPLEKT');
ALTER TABLE "public"."Product" ALTER COLUMN "unit" DROP DEFAULT;
ALTER TABLE "public"."Product" ALTER COLUMN "unit" TYPE "public"."UnitType_new" USING ("unit"::text::"public"."UnitType_new");
ALTER TYPE "public"."UnitType" RENAME TO "UnitType_old";
ALTER TYPE "public"."UnitType_new" RENAME TO "UnitType";
DROP TYPE "public"."UnitType_old";
ALTER TABLE "public"."Product" ALTER COLUMN "unit" SET DEFAULT 'DONA';
COMMIT;

-- DropIndex
DROP INDEX "public"."Asset_code_key";

-- DropIndex
DROP INDEX "public"."Assignment_userId_assetId_key";

-- DropIndex
DROP INDEX "public"."Department_code_key";

-- DropIndex
DROP INDEX "public"."Operation_fromUserId_idx";

-- DropIndex
DROP INDEX "public"."Product_code_key";

-- DropIndex
DROP INDEX "public"."Product_isActive_idx";

-- AlterTable
ALTER TABLE "public"."Asset" DROP COLUMN "code",
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Assignment" DROP COLUMN "createdAt",
ADD COLUMN     "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "returnedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Department" DROP COLUMN "code",
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Operation" ALTER COLUMN "quantity" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "code",
DROP COLUMN "isActive",
ADD COLUMN     "year" INTEGER,
ALTER COLUMN "unit" SET DEFAULT 'DONA';

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "email";

-- CreateIndex
CREATE INDEX "Asset_deletedAt_idx" ON "public"."Asset"("deletedAt");

-- CreateIndex
CREATE INDEX "Department_deletedAt_idx" ON "public"."Department"("deletedAt");

-- CreateIndex
CREATE INDEX "Operation_assetId_idx" ON "public"."Operation"("assetId");
