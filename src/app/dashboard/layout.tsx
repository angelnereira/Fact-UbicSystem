
"use client";

import { AppShell } from "@/components/app-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- AUTHENTICATION DISABLED FOR DEVELOPMENT ---
  // const { user, isUserLoading } = useUser();
  // const router = useRouter();

  // useEffect(() => {
  //   if (!isUserLoading && !user) {
  //     router.push("/login");
  //   }
  // }, [user, isUserLoading, router]);

  // if (isUserLoading || !user) {
  //   return (
  //     <div className="flex h-screen w-full items-center justify-center">
  //       <Loader2 className="h-8 w-8 animate-spin" />
  //     </div>
  //   );
  // }

  return <AppShell>{children}</AppShell>;
}
