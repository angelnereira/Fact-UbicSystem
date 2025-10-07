import { redirect } from "next/navigation";

export default function InvoicesPage() {
  // This page is now a directory, redirect to a default child or dashboard.
  redirect("/dashboard/invoices/status");
}
