-- AlterTable
ALTER TABLE "MarketplaceOutboundOffer"
ADD COLUMN "localListingId" TEXT;

-- CreateIndex
CREATE INDEX "MarketplaceOutboundOffer_localListingId_sentAt_idx" ON "MarketplaceOutboundOffer"("localListingId", "sentAt" DESC);

-- AddForeignKey
ALTER TABLE "MarketplaceOutboundOffer" ADD CONSTRAINT "MarketplaceOutboundOffer_localListingId_fkey" FOREIGN KEY ("localListingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
