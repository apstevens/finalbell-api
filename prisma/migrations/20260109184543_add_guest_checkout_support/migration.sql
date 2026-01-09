-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "orderType" TEXT NOT NULL DEFAULT 'guest',
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Order_guestEmail_idx" ON "Order"("guestEmail");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_orderType_idx" ON "Order"("orderType");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
