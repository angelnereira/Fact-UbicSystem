"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useConfigurations } from "@/hooks/use-configurations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CancelInvoicePage() {
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [configId, setConfigId] = useState('');
  const [environment, setEnvironment] = useState<'demo' | 'prod'>('demo');
  const { toast } = useToast();
  const { configs, loading: loadingConfigs } = useConfigurations();

  const handleCancel = async () => {
    if (!invoiceId || !reason || !configId || !environment) {
      toast({
        variant: "destructive",
        title: "Información Faltante",
        description: "Todos los campos son requeridos para anular la factura.",
      });
      return;
    }
    setIsLoading(true);

    try {
        const response = await fetch('/api/hka/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId, reason, configId, environment }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error desconocido del servidor');
        }
        
        toast({
            title: "Solicitud de Anulación Enviada",
            description: `La solicitud para anular la factura ${invoiceId} ha sido procesada.`,
        });
        setInvoiceId("");
        setReason("");

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Fallo en la Anulación",
            description: error.message || `No se pudo anular la factura ${invoiceId}.`,
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Anular Factura"
        description="Envía una solicitud para anular una factura electrónica timbrada."
      />

      <Card>
        <CardHeader>
          <CardTitle>Solicitud de Anulación</CardTitle>
          <CardDescription>
            Ingresa el UUID o Folio de la factura a anular y proporciona un motivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <label htmlFor="configId" className="font-medium">Cliente HKA</label>
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
             <div className="space-y-2">
                <label htmlFor="environment" className="font-medium">Ambiente HKA</label>
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
          <div className="space-y-2">
            <label htmlFor="invoiceId" className="font-medium">ID de Factura (UUID o Folio)</label>
            <Input
              id="invoiceId"
              placeholder="Ej: a1b2c3d4-e5f6-..."
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
             <label htmlFor="reason" className="font-medium">Motivo de Anulación</label>
            <Textarea
              id="reason"
              placeholder="Ej: Error en los datos del cliente"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Este motivo será enviado a la autoridad fiscal.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!invoiceId || !reason || isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Solicitar Anulación
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción es irreversible y enviará una solicitud formal de anulación para la factura{" "}
                  <strong>{invoiceId}</strong>. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Volver</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sí, Anular Factura
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </main>
  );
}
