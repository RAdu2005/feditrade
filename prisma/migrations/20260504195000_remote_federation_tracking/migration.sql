-- CreateEnum
CREATE TYPE "FederationFollowStatus" AS ENUM ('PENDING', 'ACCEPTED', 'ERROR');

-- CreateEnum
CREATE TYPE "FederatedListingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED');

-- AlterTable
ALTER TABLE "MarketplaceOutboundOffer"
ADD COLUMN "federatedListingId" TEXT;

-- CreateTable
CREATE TABLE "FederationTrackedInstance" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "inbox" TEXT NOT NULL,
    "sharedInbox" TEXT,
    "followStatus" "FederationFollowStatus" NOT NULL DEFAULT 'PENDING',
    "followError" TEXT,
    "lastFollowAttemptAt" TIMESTAMP(3),
    "lastFollowAcceptedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederationTrackedInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FederatedListing" (
    "id" TEXT NOT NULL,
    "trackedInstanceId" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "remoteActorId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceAmount" DECIMAL(10,2),
    "priceCurrency" TEXT,
    "location" TEXT,
    "category" TEXT,
    "proposalPurpose" "MarketplaceProposalPurpose" NOT NULL DEFAULT 'OFFER',
    "availableQuantity" DECIMAL(14,4),
    "minimumQuantity" DECIMAL(14,4),
    "unitCode" TEXT,
    "resourceConformsTo" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "status" "FederatedListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "imageAttachmentsJson" JSONB NOT NULL,
    "rawProposalJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "updatedAtRemote" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederatedListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FederationTrackedInstance_domain_key" ON "FederationTrackedInstance"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "FederationTrackedInstance_actorId_key" ON "FederationTrackedInstance"("actorId");

-- CreateIndex
CREATE INDEX "FederationTrackedInstance_followStatus_updatedAt_idx" ON "FederationTrackedInstance"("followStatus", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FederatedListing_proposalId_key" ON "FederatedListing"("proposalId");

-- CreateIndex
CREATE INDEX "FederatedListing_sourceDomain_createdAt_idx" ON "FederatedListing"("sourceDomain", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FederatedListing_status_createdAt_idx" ON "FederatedListing"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FederatedListing_remoteActorId_status_createdAt_idx" ON "FederatedListing"("remoteActorId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MarketplaceOutboundOffer_federatedListingId_sentAt_idx" ON "MarketplaceOutboundOffer"("federatedListingId", "sentAt" DESC);

-- AddForeignKey
ALTER TABLE "MarketplaceOutboundOffer" ADD CONSTRAINT "MarketplaceOutboundOffer_federatedListingId_fkey" FOREIGN KEY ("federatedListingId") REFERENCES "FederatedListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederationTrackedInstance" ADD CONSTRAINT "FederationTrackedInstance_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FederatedListing" ADD CONSTRAINT "FederatedListing_trackedInstanceId_fkey" FOREIGN KEY ("trackedInstanceId") REFERENCES "FederationTrackedInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
