"use client";

import { useState } from "react";
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";

type StatusResult = {
  status: 'stamped' | 'cancelled' | 'processing' | 'error' | 'not_found';
  message: string;
  uuid?: string;
  folio?: string;
  timestamp?: string;
}

const statusInfo = {
  stamped: {
    icon: CheckCircle,
    color: "text-green-600",
    title: "Timbrada",
  },
  cancelled: {
    icon: XCircle,
    color: "text-red-600",
    title: "Anulada",
  },
   processing: {
    icon: Clock,
    color: "text-blue-600",
    title: "Procesando",
  },
  error: {
    icon: AlertCircle,
    color: "text-orange-600",
    title: "Error",
  },
  not_found: {
    icon: AlertCircle,
    color: "text-gray-500",
    title: "No Encontrada",
  }
};


export default function InvoiceStatusPage() {
  const [invoiceId, setInvoiceId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StatusResult | null>(null);

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId) return;

    setIsLoading(true);
    setResult(null);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Mocked responses
    const responses: StatusResult[] = [
      { status: 'stamped', message: 'La factura fue timbrada y validada exitosamente por la autoridad fiscal.', uuid: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6', folio: invoiceId, timestamp: new Date().toISOString() },
      { status: 'cancelled', message: 'Esta factura ha sido anulada exitosamente.', uuid: 'b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5p6q7', folio: invoiceId, timestamp: new Date().toISOString() },
      { status: 'processing', message: 'La factura ha sido recibida y se está procesando actualmente.', folio: invoiceId },
      { status: 'error', message: 'Ocurrió un error durante el timbrado: "Código de item inválido".', folio: invoiceId },
      { status: 'not_found', message: 'No se encontró ninguna factura con el ID especificado.', folio: invoiceId },
    ];
    
    const mockResponse = responses[Math.floor(Math.random() * responses.length)];
    setResult(mockResponse);

    setIsLoading(false);
  };

  const renderResult = () => {
    if (!result) return null;
    
    const Icon = statusInfo[result.status].icon;
    const color = statusInfo[result.status].color;
    const title = statusInfo[result.status].title;

    return (
       <Card className="mt-6">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <Icon className={`mt-1 h-6 w-6 ${color}`} />
          <div className="flex-1">
            <CardTitle className={color}>{title}</CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            {result.folio && <p><strong>Folio/ID Consultado:</strong> {result.folio}</p>}
            {result.uuid && <p><strong>UUID:</strong> {result.uuid}</p>}
            {result.timestamp && <p><strong>Fecha y Hora:</strong> {new Date(result.timestamp).toLocaleString()}</p>}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Estado de Factura"
        description="Consulta el estado actual de una factura electrónica."
      />

      <Card>
        <CardHeader>
          <CardTitle>Consultar Estado</CardTitle>
          <CardDescription>
            Ingresa un ID de factura (UUID o Folio) para consultar su estado actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCheckStatus} className="flex items-center gap-4">
            <Input
              id="invoiceId"
              placeholder="Ej: FAC-2024001 o UUID"
              className="max-w-sm"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            />
            <Button type="submit" disabled={isLoading || !invoiceId}>
              {isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Consultar Estado
            </Button>
          </form>
        </CardContent>
      </Card>

      {renderResult()}
    </main>
  );
}
