'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type DependencyList,
} from 'react';
import { getApps, initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  type Auth,
  type User,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// --- ERROR HANDLING & EMITTER (Consolidated) ---

/**
 * A custom error class for Firestore permission issues, designed to be
 * self-explanatory for debugging.
 */
export class FirestorePermissionError extends Error {
  constructor(context: {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
    requestResourceData?: any;
  }) {
    const message = `Firebase permission denied on ${context.operation} at path: ${context.path}`;
    super(message);
    this.name = 'FirestorePermissionError';
  }
}

interface AppEvents {
  'permission-error': FirestorePermissionError;
}

type Callback<T> = (data: T) => void;

// A simple, strongly-typed event emitter.
function createEventEmitter<T extends Record<string, any>>() {
  const events: { [K in keyof T]?: Array<Callback<T[K]>> } = {};
  return {
    on<K extends keyof T>(eventName: K, callback: Callback<T[K]>) {
      if (!events[eventName]) events[eventName] = [];
      events[eventName]?.push(callback);
    },
    off<K extends keyof T>(eventName: K, callback: Callback<T[K]>) {
      events[eventName] = events[eventName]?.filter(cb => cb !== callback);
    },
    emit<K extends keyof T>(eventName: K, data: T[K]) {
      events[eventName]?.forEach(callback => callback(data));
    },
  };
}

export const errorEmitter = createEventEmitter<AppEvents>();

// --- ERROR LISTENER COMPONENT (Consolidated) ---

/**
 * An internal component that listens for globally emitted permission errors
 * and throws them to be caught by a Next.js error boundary.
 */
function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      setError(error);
    };
    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (error) {
    throw error;
  }

  return null;
}

// --- FIREBASE PROVIDER & CONTEXT ---

interface FirebaseServices {
  firebaseApp: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState extends FirebaseServices, UserAuthState {}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(
  undefined
);

/**
 * Initializes and provides Firebase services and auth state to its children.
 * This is the main entry point for client-side Firebase.
 */
export function FirebaseProvider({ children }: { children: ReactNode }) {
  // Memoize Firebase initialization to ensure it only runs once.
  const services = useMemo<FirebaseServices>(() => {
    if (typeof window === "undefined") {
      return { firebaseApp: null, auth: null, firestore: null };
    }
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    return {
      firebaseApp: app,
      auth: getAuth(app),
      firestore: getFirestore(app),
    };
  }, []);

  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  // Subscribe to authentication state changes.
  useEffect(() => {
    if (!services.auth) {
      setUserAuthState({ user: null, isUserLoading: false, userError: null });
      return;
    }
    const unsubscribe = onAuthStateChanged(
      services.auth,
      firebaseUser => {
        setUserAuthState({
          user: firebaseUser,
          isUserLoading: false,
          userError: null,
        });
      },
      error => {
        console.error('FirebaseProvider: onAuthStateChanged error:', error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe();
  }, [services.auth]);

  const contextValue: FirebaseContextState = {
    ...services,
    ...userAuthState,
  };

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}

// --- HOOKS ---

/**
 * Main hook to access all Firebase services and user state.
 * Throws an error if used outside a FirebaseProvider.
 */
export const useFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return context;
};

/** Hook to access the Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  if (!auth) {
    throw new Error('Firebase Auth not initialized. Make sure you are using this hook within a FirebaseProvider.');
  }
  return auth;
}

/** Hook to access the Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
   if (!firestore) {
    throw new Error('Firestore not initialized. Make sure you are using this hook within a FirebaseProvider.');
  }
  return firestore;
}

/** Hook to access the Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
   if (!firebaseApp) {
    throw new Error('Firebase App not initialized. Make sure you are using this hook within a FirebaseProvider.');
  }
  return firebaseApp;
}

/** Hook to access the authenticated user's state. */
export const useUser = (): UserAuthState => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};

/**
 * A hook for memoizing Firebase queries or references.
 * It's a wrapper around React's useMemo for better semantics.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
