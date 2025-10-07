import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  FileStack,
  PlusCircle,
  PlugZap,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { RecentInvoices } from "@/components/recent-invoices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { consultarFolios } from "@/lib/hka/client";

export const metadata: Metadata = {
  title: "Dashboard | Fact-UbicSystem",
};

// Make the component async to fetch data on the server
export default async function DashboardPage() {
  let remainingFolios = 0;
  let foliosError = false;
  try {
    // This now reads credentials from Firestore dynamically
    remainingFolios = await consultarFolios();
  } catch (error) {
    console.error("Error al consultar folios para el dashboard:", error);
    foliosError = true;
    // The function will return a mock value or 0 on error, so UI won't break
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Resumen del Dashboard"
        description="Supervisa tu sistema de facturación de un vistazo."
      >
        <Button asChild>
          <Link href="/dashboard/invoices/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Factura
          </Link>
        </Button>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
        <StatCard
          title="Salud del Sistema"
          value="Operacional"
          icon={Activity}
          description="Todos los sistemas funcionan correctamente."
          status="success"
        />
        <StatCard
          title="Conexión HKA"
          value={foliosError ? "Error" : "Conectado"}
          icon={PlugZap}
          description={foliosError ? "Fallo al conectar con HKA" : "Conexión segura a The Factory HKA."}
          status={foliosError ? "danger" : "success"}
        />
        <StatCard
          title="Folios Restantes"
          value={remainingFolios.toLocaleString()}
          icon={FileStack}
          description="Folios disponibles para timbrar."
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <RecentInvoices />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="outline" asChild>
              <Link href="/dashboard/movements">
                <GitBranch className="mr-2 h-4 w-4" />
                Ver Movimientos
              </Link>
            </Button>
             <Button variant="outline" asChild>
              <Link href="/dashboard/settings">
                <PlugZap className="mr-2 h-4 w-4" />
                Configurar HKA
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/invoices/status">
                <FileStack className="mr-2 h-4 w-4" />
                Consultar Estado de Factura
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
