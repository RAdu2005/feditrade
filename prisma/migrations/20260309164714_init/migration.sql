-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'REMOVED');

-- CreateEnum
CREATE TYPE "DeliveryJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('TAKE_DOWN_LISTING', 'RESTORE_LISTING', 'RETRY_JOB');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "mastodonDomain" TEXT NOT NULL,
    "mastodonAccountId" TEXT NOT NULL,
    "mastodonUsername" TEXT NOT NULL,
    "mastodonActorUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastodonOAuthClient" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MastodonOAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastodonOAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "instanceDomain" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MastodonOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceAmount" DECIMAL(10,2),
    "priceCurrency" TEXT,
    "location" TEXT,
    "category" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "canonicalUrl" TEXT NOT NULL,
    "activityPubObjectId" TEXT NOT NULL,
    "latestOutboxActivityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingImage" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FederationFollower" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "inbox" TEXT NOT NULL,
    "sharedInbox" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederationFollower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxActivity" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "activityJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FederationDeliveryJob" (
    "id" TEXT NOT NULL,
    "targetActor" TEXT,
    "targetInbox" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityJson" JSONB NOT NULL,
    "status" "DeliveryJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederationDeliveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxActivityLog" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "rawActivity" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "actionType" "AdminActionType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_mastodonActorUri_key" ON "User"("mastodonActorUri");

-- CreateIndex
CREATE UNIQUE INDEX "User_mastodonDomain_mastodonAccountId_key" ON "User"("mastodonDomain", "mastodonAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MastodonOAuthClient_domain_key" ON "MastodonOAuthClient"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "MastodonOAuthState_state_key" ON "MastodonOAuthState"("state");

-- CreateIndex
CREATE INDEX "MastodonOAuthState_expiresAt_idx" ON "MastodonOAuthState"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_canonicalUrl_key" ON "Listing"("canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_activityPubObjectId_key" ON "Listing"("activityPubObjectId");

-- CreateIndex
CREATE INDEX "Listing_status_createdAt_id_idx" ON "Listing"("status", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Listing_ownerId_createdAt_idx" ON "Listing"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ListingImage_key_key" ON "ListingImage"("key");

-- CreateIndex
CREATE INDEX "ListingImage_listingId_idx" ON "ListingImage"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingImage_listingId_position_key" ON "ListingImage"("listingId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FederationFollower_actor_key" ON "FederationFollower"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxActivity_activityId_key" ON "OutboxActivity"("activityId");

-- CreateIndex
CREATE INDEX "OutboxActivity_publishedAt_idx" ON "OutboxActivity"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "FederationDeliveryJob_status_nextAttemptAt_idx" ON "FederationDeliveryJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "FederationDeliveryJob_activityId_idx" ON "FederationDeliveryJob"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxActivityLog_activityId_key" ON "InboxActivityLog"("activityId");

-- CreateIndex
CREATE INDEX "InboxActivityLog_receivedAt_idx" ON "InboxActivityLog"("receivedAt" DESC);

-- CreateIndex
CREATE INDEX "InboxActivityLog_actor_idx" ON "InboxActivityLog"("actor");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxActivity" ADD CONSTRAINT "OutboxActivity_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
