-- AlterEnum
ALTER TYPE "public"."OperationType" ADD VALUE 'ASSIGN_TO_DEPT';

-- DropForeignKey
ALTER TABLE "public"."Assignment" DROP CONSTRAINT "Assignment_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Assignment" ADD COLUMN     "departmentId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Assignment_departmentId_idx" ON "public"."Assignment"("departmentId");

-- CreateIndex
CREATE INDEX "Assignment_departmentId_returnedAt_idx" ON "public"."Assignment"("departmentId", "returnedAt");

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
