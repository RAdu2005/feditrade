import { env } from "./env";
import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

function parseTargetSpec(spec: string) {
  const [actor, inbox] = spec.split("|").map((part) => part?.trim());
  if (!inbox) {
    return null;
  }
  return {
    actor: actor || null,
    inbox,
  };
}

async function deliveryTargets() {
  const followers = await prisma.federationFollower.findMany({
    select: {
      actor: true,
      inbox: true,
      sharedInbox: true,
    },
  });

  const staticTargets = env.AP_FEDERATION_TARGETS.map(parseTargetSpec).filter(Boolean) as {
    actor: string | null;
    inbox: string;
  }[];

  const combined = [
    ...followers.map((follower) => ({
      actor: follower.actor,
      inbox: follower.sharedInbox ?? follower.inbox,
    })),
    ...staticTargets,
  ];

  const deduped = new Map<string, { actor: string | null; inbox: string }>();
  for (const target of combined) {
    if (!deduped.has(target.inbox)) {
      deduped.set(target.inbox, target);
    }
  }

  return [...deduped.values()];
}

export async function enqueueActivityDelivery(activity: {
  id: string;
  type: string;
  listingId: string;
  body: Record<string, unknown>;
}) {
  await prisma.outboxActivity.create({
    data: {
      activityId: activity.id,
      activityType: activity.type,
      listingId: activity.listingId,
      activityJson: activity.body as Prisma.InputJsonValue,
    },
  });

  const targets = await deliveryTargets();
  if (targets.length === 0) {
    return 0;
  }

  await prisma.federationDeliveryJob.createMany({
    data: targets.map((target) => ({
      targetActor: target.actor,
      targetInbox: target.inbox,
      activityId: activity.id,
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
