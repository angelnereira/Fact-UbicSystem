'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

// Props for the FirebaseProvider component.
interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Shape of the authentication state.
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Shape of the value provided by the FirebaseContext.
export interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// The React Context that will hold our Firebase state.
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * Provides Firebase services (app, auth, firestore) and user authentication
 * state to all descendant components.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start in a loading state.
    userError: null,
  });

  // Effect to subscribe to Firebase auth state changes.
  useEffect(() => {
    // Set up the listener for authentication state changes.
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        // When the auth state is determined, update our state.
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => {
        // If the listener itself fails, record the error.
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    // Cleanup: Unsubscribe from the listener when the component unmounts.
    return () => unsubscribe();
  }, [auth]); // Re-run this effect only if the auth instance itself changes.

  // The context value now directly uses the props and state.
  // It is inherently stable as long as the provider's props don't change.
  const contextValue: FirebaseContextState = {
    firebaseApp,
    firestore,
    auth,
    user: userAuthState.user,
    isUserLoading: userAuthState.isUserLoading,
    userError: userAuthState.userError,
  };

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

// --- HOOKS ---

/**
 * Hook to access all core Firebase services and user state.
 * Throws an error if used outside of a FirebaseProvider.
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
  return auth;
};

/** Hook to access the Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access the Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

/**
 * A hook for memoizing Firebase queries or references.
 * It adds a flag to help prevent accidental un-memoized usage in other hooks.
 */
type MemoFirebase<T> = T & { __memo?: boolean };

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  const memoized = useMemo(factory, deps);
  
  if (typeof memoized === 'object' && memoized !== null) {
    // Add a non-enumerable property to mark this object as memoized.
    Object.defineProperty(memoized, '__memo', { value: true, enumerable: false });
  }
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * @returns An object with the user, loading status, and any auth errors.
 */
export const useUser = (): UserAuthState => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};
