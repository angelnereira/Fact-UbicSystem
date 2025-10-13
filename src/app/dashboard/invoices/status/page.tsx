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
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfigurations } from "@/hooks/use-configurations";

type StatusResult = {
  status: 'stamped' | 'cancelled' | 'processing' | 'error' | 'not_found' | 'failed';
  message: string;
  uuid?: string;
  folio?: string;
  timestamp?: string;
}

const statusInfo: Record<StatusResult['status'], { icon: React.ElementType; color: string; title: string }> = {
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
  },
  failed: {
    icon: XCircle,
    color: "text-red-600",
    title: "Fallida",
  }
};


export default function InvoiceStatusPage() {
  const [invoiceId, setInvoiceId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StatusResult | null>(null);
  const [configId, setConfigId] = useState('');
  const [environment, setEnvironment] = useState<'demo' | 'prod'>('demo');
  const { toast } = useToast();
  const { configs, loading: loadingConfigs } = useConfigurations();

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId || !configId || !environment) {
        toast({
            variant: 'destructive',
            title: 'Información Faltante',
            description: 'Por favor, selecciona un cliente, un ambiente y proporciona un ID de factura.',
        });
        return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/hka/status/${invoiceId}?configId=${configId}&env=${environment}`);
      const data: StatusResult = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error en la consulta');
      }

      setResult(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de Consulta',
        description: error.message,
      });
      setResult({ status: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;
    
    const Icon = statusInfo[result.status]?.icon || AlertCircle;
    const color = statusInfo[result.status]?.color || 'text-gray-500';
    const title = statusInfo[result.status]?.title || 'Desconocido';

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
          <form onSubmit={handleCheckStatus} className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="configId" className="block text-sm font-medium mb-1">Cliente HKA</label>
                   <Select onValueChange={setConfigId} value={configId} disabled={loadingConfigs}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el cliente emisor..." />
                      </SelectTrigger>
                    <SelectContent>
                      {configs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="environment" className="block text-sm font-medium mb-1">Ambiente</label>
                  <Select onValueChange={(value) => setEnvironment(value as 'demo' | 'prod')} value={environment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el ambiente..." />
                      </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="prod">Producción</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
            </div>
            <div>
               <label htmlFor="invoiceId" className="block text-sm font-medium mb-1">ID de Factura (UUID o Folio)</label>
              <Input
                id="invoiceId"
                placeholder="Ej: FAC-2024001 o UUID"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              />
            </div>
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
