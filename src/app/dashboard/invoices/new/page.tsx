import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { InvoiceForm } from "@/components/invoice-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Nueva Factura | Fact-UbicSystem",
};

export default function NewInvoicePage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Crear Nueva Factura"
        description="Completa el formulario para crear y timbrar manualmente una nueva factura."
      />
      <Card>
        <CardContent className="pt-6">
          <InvoiceForm />
        </CardContent>
      </Card>
    </main>
  );
}
