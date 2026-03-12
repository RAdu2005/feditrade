-- CreateEnum
CREATE TYPE "FederationProjectionType" AS ENUM ('LEGACY_NOTE', 'MARKETPLACE_CANONICAL', 'MARKETPLACE_RESPONSE', 'MARKETPLACE_CONFIRMATION');

-- CreateEnum
CREATE TYPE "InboxWorkflowType" AS ENUM ('SOCIAL', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "MarketplaceProposalPurpose" AS ENUM ('OFFER', 'REQUEST');

-- CreateEnum
CREATE TYPE "MarketplaceProposalStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MarketplaceOfferStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketplaceAgreementStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Listing"
ADD COLUMN "proposalPurpose" "MarketplaceProposalPurpose" NOT NULL DEFAULT 'OFFER',
ADD COLUMN "availableQuantity" DECIMAL(14,4),
ADD COLUMN "minimumQuantity" DECIMAL(14,4),
ADD COLUMN "unitCode" TEXT,
ADD COLUMN "resourceConformsTo" TEXT,
ADD COLUMN "validFrom" TIMESTAMP(3),
ADD COLUMN "validUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OutboxActivity"
ADD COLUMN "projectionType" "FederationProjectionType" NOT NULL DEFAULT 'LEGACY_NOTE',
ADD COLUMN "proposalId" TEXT,
ADD COLUMN "offerId" TEXT,
ADD COLUMN "agreementId" TEXT;

-- AlterTable
ALTER TABLE "FederationDeliveryJob"
ADD COLUMN "projectionType" "FederationProjectionType" NOT NULL DEFAULT 'LEGACY_NOTE';

-- AlterTable
ALTER TABLE "InboxActivityLog"
ADD COLUMN "targetObjectId" TEXT,
ADD COLUMN "workflowType" "InboxWorkflowType" NOT NULL DEFAULT 'SOCIAL';

-- CreateTable
CREATE TABLE "MarketplaceProposal" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "activityPubId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "purpose" "MarketplaceProposalPurpose" NOT NULL DEFAULT 'OFFER',
    "status" "MarketplaceProposalStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedIntentJson" JSONB NOT NULL,
    "reciprocalIntentJson" JSONB,
    "unitBased" BOOLEAN NOT NULL DEFAULT false,
    "availableQuantity" DECIMAL(14,4),
    "minimumQuantity" DECIMAL(14,4),
    "unitCode" TEXT,
    "resourceConformsTo" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "lastAnnouncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOffer" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "remoteActorId" TEXT NOT NULL,
    "remoteInbox" TEXT NOT NULL,
    "agreementJson" JSONB NOT NULL,
    "status" "MarketplaceOfferStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceAgreement" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "offerId" TEXT,
    "activityPubId" TEXT NOT NULL,
    "sellerActorId" TEXT NOT NULL,
    "buyerActorId" TEXT NOT NULL,
    "agreementJson" JSONB NOT NULL,
    "status" "MarketplaceAgreementStatus" NOT NULL DEFAULT 'ACCEPTED',
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCommitment" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "commitmentJson" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceConfirmation" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "documentJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProposal_listingId_key" ON "MarketplaceProposal"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProposal_activityPubId_key" ON "MarketplaceProposal"("activityPubId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOffer_activityId_key" ON "MarketplaceOffer"("activityId");

-- CreateIndex
CREATE INDEX "MarketplaceOffer_proposalId_receivedAt_idx" ON "MarketplaceOffer"("proposalId", "receivedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAgreement_offerId_key" ON "MarketplaceAgreement"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceAgreement_activityPubId_key" ON "MarketplaceAgreement"("activityPubId");

-- CreateIndex
CREATE INDEX "MarketplaceAgreement_proposalId_createdAt_idx" ON "MarketplaceAgreement"("proposalId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MarketplaceCommitment_agreementId_createdAt_idx" ON "MarketplaceCommitment"("agreementId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceConfirmation_activityId_key" ON "MarketplaceConfirmation"("activityId");

-- CreateIndex
CREATE INDEX "MarketplaceConfirmation_agreementId_publishedAt_idx" ON "MarketplaceConfirmation"("agreementId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "OutboxActivity_projectionType_publishedAt_idx" ON "OutboxActivity"("projectionType", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "InboxActivityLog_workflowType_receivedAt_idx" ON "InboxActivityLog"("workflowType", "receivedAt" DESC);

-- AddForeignKey
ALTER TABLE "MarketplaceProposal" ADD CONSTRAINT "MarketplaceProposal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOffer" ADD CONSTRAINT "MarketplaceOffer_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "MarketplaceProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAgreement" ADD CONSTRAINT "MarketplaceAgreement_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "MarketplaceProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAgreement" ADD CONSTRAINT "MarketplaceAgreement_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MarketplaceOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCommitment" ADD CONSTRAINT "MarketplaceCommitment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "MarketplaceAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceConfirmation" ADD CONSTRAINT "MarketplaceConfirmation_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "MarketplaceAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxActivity" ADD CONSTRAINT "OutboxActivity_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "MarketplaceProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxActivity" ADD CONSTRAINT "OutboxActivity_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MarketplaceOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxActivity" ADD CONSTRAINT "OutboxActivity_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "MarketplaceAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
