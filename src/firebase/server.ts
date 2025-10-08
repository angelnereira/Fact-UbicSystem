
import { initializeApp, getApp, getApps, FirebaseApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

/**
 * Initializes and/or retrieves the server-side Firebase app and its services.
 * This function is now idempotent and ensures that the app is only initialized once.
 * It will always return the necessary SDKs.
 */
export function initializeFirebase() {
  let app: App;

  if (!getApps().length) {
    // When deployed to App Hosting, the service account credentials will be
    // automatically available through environment variables.
    // The initializeApp() function without arguments will use these credentials.
    app = initializeApp({
      // projectId is needed for local development when GOOGLE_APPLICATION_CREDENTIALS
      // is not set.
      projectId: firebaseConfig.projectId,
    });
  } else {
    app = getApp();
  }

  // CRITICAL FIX: Always return the SDKs, regardless of whether the app was
  // just initialized or already existed.
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}
