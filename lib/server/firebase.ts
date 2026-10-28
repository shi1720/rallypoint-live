import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
const projectId =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
function app() {
  return (
    getApps()[0] ??
    initializeApp({ projectId, credential: applicationDefault() })
  );
}
export function firebaseAuth() {
  return getAuth(app());
}
export function firestore() {
  return getFirestore(app(), process.env.FIRESTORE_DATABASE_ID || "rallypoint");
}
export function webConfig() {
  const raw = process.env.FIREBASE_WEB_CONFIG;
  if (!raw) throw new Error("Authentication configuration is unavailable.");
  const parsed = JSON.parse(raw);
  return {
    apiKey: parsed.apiKey,
    authDomain: parsed.authDomain,
    projectId: parsed.projectId,
    appId: parsed.appId,
    messagingSenderId: parsed.messagingSenderId,
  };
}
