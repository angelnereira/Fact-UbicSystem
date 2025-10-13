"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  FileStack,
  PlusCircle,
  PlugZap,
  GitBranch,
} from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { RecentInvoices, type RecentInvoice } from "@/components/recent-invoices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { FoliosStatCard } from "@/components/folios-stat-card";


export default function DashboardPage() {
  const firestore = useFirestore();
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const invoicesQuery = useMemoFirebase(
    () => firestore 
      ? query(collection(firestore, "invoiceSubmissions"), orderBy("submissionDate", "desc"), limit(5))
      : null,
    [firestore]
  );
  
  useEffect(() => {
    if (!invoicesQuery) {
        setLoading(false);
        return;
    };
    const unsubscribe = onSnapshot(invoicesQuery, (querySnapshot) => {
       if (querySnapshot.empty) {
        setRecentInvoices([]);
        setLoading(false);
        return;
      }
      const invoices = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let customerName = 'N/A';
        let customerTaxId = 'N/A';
        try {
          const invoiceData = JSON.parse(data.invoiceData);
          customerName = invoiceData.customerName || 'N/A';
          customerTaxId = invoiceData.customerRuc || 'N/A';
        } catch {}

        return {
          id: doc.id,
          customerName,
          customerTaxId,
          status: data.status,
          createdAt: new Date(data.submissionDate),
        };
      });
      setRecentInvoices(invoices);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching recent invoices:", error);
        setRecentInvoices([]);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [invoicesQuery]);


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
          value={"Conectado"}
          icon={PlugZap}
          description={"Conexión segura a The Factory HKA."}
          status={"success"}
        />
        <FoliosStatCard />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <RecentInvoices initialInvoices={recentInvoices} />
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
