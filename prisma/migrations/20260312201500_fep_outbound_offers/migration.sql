-- CreateEnum
CREATE TYPE "MarketplaceOutboundOfferStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MarketplaceOutboundOffer" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetProposalId" TEXT NOT NULL,
    "targetActorId" TEXT NOT NULL,
    "targetInbox" TEXT NOT NULL,
    "agreementJson" JSONB NOT NULL,
    "status" "MarketplaceOutboundOfferStatus" NOT NULL DEFAULT 'SENT',
    "responseActivityId" TEXT,
    "responseJson" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOutboundOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOutboundAgreement" (
    "id" TEXT NOT NULL,
    "outboundOfferId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "agreementJson" JSONB NOT NULL,
    "status" "MarketplaceAgreementStatus" NOT NULL DEFAULT 'ACCEPTED',
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOutboundAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOutboundConfirmation" (
    "id" TEXT NOT NULL,
    "outboundOfferId" TEXT NOT NULL,
    "outboundAgreementId" TEXT,
    "activityId" TEXT NOT NULL,
    "documentJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceOutboundConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOutboundOffer_activityId_key" ON "MarketplaceOutboundOffer"("activityId");

-- CreateIndex
CREATE INDEX "MarketplaceOutboundOffer_localUserId_sentAt_idx" ON "MarketplaceOutboundOffer"("localUserId", "sentAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOutboundAgreement_outboundOfferId_key" ON "MarketplaceOutboundAgreement"("outboundOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOutboundAgreement_agreementId_key" ON "MarketplaceOutboundAgreement"("agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOutboundConfirmation_activityId_key" ON "MarketplaceOutboundConfirmation"("activityId");

-- CreateIndex
CREATE INDEX "MarketplaceOutboundConfirmation_outboundOfferId_publishedAt_idx" ON "MarketplaceOutboundConfirmation"("outboundOfferId", "publishedAt" DESC);

-- AddForeignKey
ALTER TABLE "MarketplaceOutboundOffer" ADD CONSTRAINT "MarketplaceOutboundOffer_localUserId_fkey" FOREIGN KEY ("localUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOutboundAgreement" ADD CONSTRAINT "MarketplaceOutboundAgreement_outboundOfferId_fkey" FOREIGN KEY ("outboundOfferId") REFERENCES "MarketplaceOutboundOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOutboundConfirmation" ADD CONSTRAINT "MarketplaceOutboundConfirmation_outboundOfferId_fkey" FOREIGN KEY ("outboundOfferId") REFERENCES "MarketplaceOutboundOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOutboundConfirmation" ADD CONSTRAINT "MarketplaceOutboundConfirmation_outboundAgreementId_fkey" FOREIGN KEY ("outboundAgreementId") REFERENCES "MarketplaceOutboundAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
