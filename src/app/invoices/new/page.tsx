import { redirect } from 'next/navigation';

export default function NewInvoicePageRedirect() {
  redirect('/dashboard/invoices/new');
}
