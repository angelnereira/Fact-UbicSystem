'use client';

import React, { useMemo, type ReactNode } from 'react';
import { getApps, initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { FirebaseProvider } from '@/firebase/provider';
import { firebaseConfig } from './config';

// Define the shape of the initialized Firebase services.
interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

/**
 * Initializes the Firebase app and services on the client-side.
 * This logic is memoized to ensure it runs only once.
 * @returns An object containing the initialized Firebase services.
 */
function useInitializeClientFirebase(): FirebaseServices {
  const services = useMemo(() => {
    // Check if a Firebase app has already been initialized.
    if (getApps().length === 0) {
      // If not, initialize a new app with the provided config.
      // This config is automatically populated by Firebase App Hosting in production.
      const app = initializeApp(firebaseConfig);
      return {
        firebaseApp: app,
        auth: getAuth(app),
        firestore: getFirestore(app),
      };
    }
    // If an app already exists, get the default app.
    const app = getApp();
    return {
      firebaseApp: app,
      auth: getAuth(app),
      firestore: getFirestore(app),
    };
  }, []); // The empty dependency array ensures this runs only once.

  return services;
}

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * A client-side component that initializes Firebase and provides its services
 * to its children through the FirebaseProvider.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // Initialize Firebase services using the memoized hook.
  const { firebaseApp, auth, firestore } = useInitializeClientFirebase();

  // Pass the initialized services down to the context provider.
  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
