import { FederationProjectionType, Prisma } from "@prisma/client";
import { env } from "./env";
import { prisma } from "./prisma";

type DeliveryTarget = {
  actor: string | null;
  inbox: string;
  marketplaceCapable?: boolean;
};

function parseTargetSpec(spec: string) {
  const trimmed = spec.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes("|")) {
    // Backward compatibility: allow plain inbox URLs.
    return {
      actor: null,
      inbox: trimmed,
    };
  }

  const [actor, inbox] = trimmed.split("|").map((part) => part?.trim());
  if (!inbox) {
    return null;
  }
  return {
    actor: actor || null,
    inbox,
  };
}

function hostnameFromUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function dedupeTargets(targets: DeliveryTarget[]) {
  const deduped = new Map<string, DeliveryTarget>();
  for (const target of targets) {
    const existing = deduped.get(target.inbox);
    if (!existing) {
      deduped.set(target.inbox, target);
      continue;
    }

    deduped.set(target.inbox, {
      actor: existing.actor ?? target.actor,
      inbox: target.inbox,
      marketplaceCapable: Boolean(existing.marketplaceCapable || target.marketplaceCapable),
    });
  }

  return [...deduped.values()];
}

function isMarketplaceCapableTarget(target: DeliveryTarget) {
  if (target.marketplaceCapable) {
    return true;
  }

  if (env.AP_FEP_CAPABLE_INSTANCES.length === 0) {
    return false;
  }

  const actorHost = hostnameFromUrl(target.actor);
  const inboxHost = hostnameFromUrl(target.inbox);
  return env.AP_FEP_CAPABLE_INSTANCES.some(
    (domain) => actorHost === domain || inboxHost === domain,
  );
}

async function allKnownTargets() {
  const [followers, trackedInstances] = await Promise.all([
    prisma.federationFollower.findMany({
      select: {
        actor: true,
        inbox: true,
        sharedInbox: true,
      },
    }),
    prisma.federationTrackedInstance.findMany({
      where: {
        followStatus: {
          in: ["PENDING", "ACCEPTED"],
        },
      },
      select: {
        actorId: true,
        inbox: true,
        sharedInbox: true,
      },
    }),
  ]);

  const staticTargets = env.AP_FEDERATION_TARGETS.map(parseTargetSpec).filter(Boolean) as DeliveryTarget[];

  const combined = [
    ...followers.map((follower) => ({
      actor: follower.actor,
      inbox: follower.sharedInbox ?? follower.inbox,
      marketplaceCapable: false,
    })),
    ...staticTargets,
    ...trackedInstances.map((instance) => ({
      actor: instance.actorId,
      inbox: instance.sharedInbox ?? instance.inbox,
      marketplaceCapable: true,
    })),
  ];

  return dedupeTargets(combined);
}

async function deliveryTargetsForProjection(projectionType: FederationProjectionType) {
  const targets = await allKnownTargets();

  if (projectionType === "LEGACY_NOTE") {
    return targets;
  }

  if (projectionType === "MARKETPLACE_CANONICAL") {
    return targets.filter(isMarketplaceCapableTarget);
  }

  return [];
}

export async function enqueueActivityDelivery(activity: {
  id: string;
  type: string;
  listingId: string;
  proposalId?: string;
  offerId?: string;
  agreementId?: string;
  projectionType?: FederationProjectionType;
  body: Record<string, unknown>;
  targets?: DeliveryTarget[];
}) {
  const projectionType = activity.projectionType ?? "LEGACY_NOTE";

  await prisma.outboxActivity.create({
    data: {
      activityId: activity.id,
      activityType: activity.type,
      projectionType,
      listingId: activity.listingId,
      proposalId: activity.proposalId,
      offerId: activity.offerId,
      agreementId: activity.agreementId,
      activityJson: activity.body as Prisma.InputJsonValue,
    },
  });

  const targets = dedupeTargets(
    activity.targets && activity.targets.length > 0
      ? activity.targets
      : await deliveryTargetsForProjection(projectionType),
  );

  if (targets.length === 0) {
    return 0;
  }

  await prisma.federationDeliveryJob.createMany({
    data: targets.map((target) => ({
      targetActor: target.actor,
      targetInbox: target.inbox,
      activityId: activity.id,
      projectionType,
      activityJson: activity.body as Prisma.InputJsonValue,
    })),
  });

  return targets.length;
}

export async function getNextDeliveryJob() {
  const now = new Date();
  return prisma.federationDeliveryJob.findFirst({
    where: {
      status: "PENDING",
      nextAttemptAt: {
        lte: now,
      },
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function markDeliveryProcessing(jobId: string) {
  return prisma.federationDeliveryJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING" },
  });
}

export async function markDeliverySuccess(jobId: string) {
  return prisma.federationDeliveryJob.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      updatedAt: new Date(),
    },
  });
}

export async function markDeliveryFailure(jobId: string, maxAttempts: number, lastError: string) {
  const job = await prisma.federationDeliveryJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return null;
  }

  const nextAttempt = job.attemptCount + 1;
  const shouldDeadLetter = nextAttempt >= maxAttempts;

  const backoffMs = Math.min(5 * 60 * 1000, 2 ** nextAttempt * 1000);
  return prisma.federationDeliveryJob.update({
    where: { id: jobId },
    data: {
      attemptCount: nextAttempt,
      lastError: lastError.slice(0, 2000),
      status: shouldDeadLetter ? "DEAD_LETTER" : "PENDING",
      nextAttemptAt: shouldDeadLetter ? job.nextAttemptAt : new Date(Date.now() + backoffMs),
    },
  });
}

export async function retryDeadLetterJob(jobId: string) {
  return prisma.federationDeliveryJob.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      nextAttemptAt: new Date(),
      lastError: null,
      attemptCount: 0,
    },
  });
}
