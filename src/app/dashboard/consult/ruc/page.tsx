"use client";

import { useState } from "react";
import { Loader2, Building, AlertCircle, CheckCircle } from "lucide-react";
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

type RucResult = {
  status: 'found' | 'not_found';
  name?: string;
  ruc?: string;
  address?: string;
  isTaxpayer?: boolean;
  message: string;
}

export default function ConsultRucPage() {
  const [ruc, setRuc] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RucResult | null>(null);

  const handleConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruc) return;

    setIsLoading(true);
    setResult(null);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Mocked responses
    const isFound = Math.random() > 0.3;
    let mockResponse: RucResult;

    if (isFound) {
      mockResponse = {
        status: 'found',
        name: 'ACME S.A.C.',
        ruc: ruc,
        address: 'Av. Principal 123, San Isidro, Lima',
        isTaxpayer: true,
        message: 'Contribuyente encontrado y activo.'
      };
    } else {
      mockResponse = {
        status: 'not_found',
        message: `No se encontró contribuyente con RUC ${ruc}.`
      };
    }
    
    setResult(mockResponse);
    setIsLoading(false);
  };

  const renderResult = () => {
    if (!result) return null;

    if (result.status === 'not_found') {
      return (
        <Card className="mt-6 border-orange-500/50">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <AlertCircle className="mt-1 h-6 w-6 text-orange-600" />
            <div className="flex-1">
              <CardTitle className="text-orange-600">No Encontrado</CardTitle>
              <CardDescription>{result.message}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      );
    }
    
    return (
       <Card className="mt-6">
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <Building className="mt-1 h-6 w-6 text-muted-foreground" />
          <div className="flex-1">
            <CardTitle>{result.name}</CardTitle>
            <CardDescription>RUC: {result.ruc}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Dirección:</strong> {result.address}</p>
            <div className="flex items-center gap-2">
              <strong>Estado:</strong>
              {result.isTaxpayer ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-4 w-4" /> Contribuyente Activo
                  </span>
              ) : (
                 <span className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="h-4 w-4" /> Inactivo
                  </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Consulta de RUC"
        description="Verifica la información de un contribuyente usando su RUC."
      />

      <Card>
        <CardHeader>
          <CardTitle>Búsqueda de RUC</CardTitle>
          <CardDescription>
            Ingresa un RUC para obtener la información pública del contribuyente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConsult} className="flex items-center gap-4">
            <Input
              id="ruc"
              placeholder="Ej: 20123456789"
              className="max-w-xs"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
            />
            <Button type="submit" disabled={isLoading || !ruc}>
              {isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Consultar
            </Button>
          </form>
        </CardContent>
      </Card>

      {renderResult()}
    </main>
  );
}
