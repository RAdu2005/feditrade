import "dotenv/config";
import { markDeliveryFailure, markDeliveryProcessing, markDeliverySuccess, getNextDeliveryJob } from "../lib/delivery-queue";
import { signFederatedRequest } from "../lib/activitypub";
import { logger } from "../lib/logger";

const POLL_INTERVAL_MS = 4000;
const IDLE_INTERVAL_MS = 3000;

async function processOneJob() {
  const job = await getNextDeliveryJob();
  if (!job) {
    return false;
  }

  await markDeliveryProcessing(job.id);
  const payload = JSON.stringify(job.activityJson);

  try {
    const targetUrl = new URL(job.targetInbox);
    const signedHeaders = signFederatedRequest({
      method: "post",
      url: targetUrl,
      body: payload,
    });

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        ...signedHeaders,
        accept: "application/activity+json",
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Remote inbox responded with ${response.status}`);
    }

    await markDeliverySuccess(job.id);
    logger.info({ jobId: job.id, inbox: job.targetInbox }, "Federation delivery succeeded");
  } catch (error) {
    await markDeliveryFailure(job.id, job.maxAttempts, error instanceof Error ? error.message : "Unknown error");
    logger.error({ jobId: job.id, err: error }, "Federation delivery failed");
  }

  return true;
}

async function run() {
  logger.info("Starting federation delivery worker");
  while (true) {
    try {
      const hadJob = await processOneJob();
      await new Promise((resolve) => setTimeout(resolve, hadJob ? POLL_INTERVAL_MS : IDLE_INTERVAL_MS));
    } catch (error) {
      logger.error({ err: error }, "Worker loop failed");
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

void run();
