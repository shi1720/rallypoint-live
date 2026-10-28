import { applicationDefault } from "firebase-admin/app";
import { store, docId } from "./store";
import { runtime } from "./env";
import { hmac, HttpError } from "./security";
export async function enqueueReply(owner: string, eventId: string) {
  const row = await store()
    .collection("outbox")
    .doc(docId(owner + ":" + eventId))
    .get();
  if (!row.exists || row.get("status") !== "pending") return;
  const e = runtime();
  if (
    !e.CLOUD_TASKS_QUEUE ||
    !e.CLOUD_TASKS_LOCATION ||
    !e.GOOGLE_CLOUD_PROJECT
  )
    throw new HttpError(503, "Reply queue is unavailable.");
  const parent = `projects/${e.GOOGLE_CLOUD_PROJECT}/locations/${e.CLOUD_TASKS_LOCATION}/queues/${e.CLOUD_TASKS_QUEUE}`;
  const body = JSON.stringify({ owner, eventId });
  const proof = await hmac(
    e.TOKEN_ENCRYPTION_KEY!,
    "rallypoint-outbox:" + body,
  );
  const token = await applicationDefault().getAccessToken();
  const response = await fetch(
    `https://cloudtasks.googleapis.com/v2/${parent}/tasks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: {
          name: `${parent}/tasks/reply-${docId(owner + ":" + eventId)}`,
          httpRequest: {
            httpMethod: "POST",
            url: `${e.SITE_URL}/api/internal/outbox`,
            headers: {
              "Content-Type": "application/json",
              "X-Rallypoint-Task": proof,
            },
            body: Buffer.from(body).toString("base64"),
          },
          dispatchDeadline: "30s",
        },
      }),
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok && response.status !== 409) {
    console.error(
      JSON.stringify({
        event: "reply_queue_rejected",
        status: response.status,
      }),
    );
    throw new HttpError(503, "Reply queue was not confirmed.");
  }
}
