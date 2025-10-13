
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// This page is archived and now bypasses the login, redirecting to the dashboard.
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
