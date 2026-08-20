-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'KADR';

-- CreateIndex
CREATE INDEX "Assignment_userId_returnedAt_idx" ON "public"."Assignment"("userId", "returnedAt");

-- CreateIndex
CREATE INDEX "Assignment_assetId_returnedAt_idx" ON "public"."Assignment"("assetId", "returnedAt");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "public"."Product"("name");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "public"."RefreshToken"("expiresAt");
