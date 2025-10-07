
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // When deployed to App Hosting, the service account credentials will be
    // automatically available through environment variables.
    // The initializeApp() function without arguments will use these credentials.
    initializeApp({
      // projectId is needed for local development when GOOGLE_APPLICATION_CREDENTIALS
      // is not set.
      projectId: firebaseConfig.projectId,
    });
  }
  return getSdks(getApp());
}

export function getSdks(app: FirebaseApp) {
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}
