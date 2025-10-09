'use client';

// Barrel file for client-side Firebase hooks and providers.

// IMPORTANT: The initializeFirebase function is now part of client-provider.tsx
// to ensure it's only run on the client.

export * from './provider';
export * from './client-provider';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';