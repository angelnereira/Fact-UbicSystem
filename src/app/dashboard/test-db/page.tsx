
'use client';
import { AlertTriangle, CheckCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, limit } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

export default function TestDbPage() {
  const firestore = useFirestore();

  const configQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, "configurations"), limit(1))
        : null,
    [firestore]
  );
  
  const { data: configData, isLoading, error } = useCollection(configQuery);

  const dbError = error;
  const dbResult = configData?.[0];

  const renderContent = () => {
    if (isLoading) {
       return (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      );
    }
    
    if (dbError) {
       return (
        <Card className="border-red-500/50">
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div className="flex-1">
              <CardTitle className="text-red-600">Conexión Fallida con Firestore</CardTitle>
              <CardDescription>
                La aplicación no pudo establecer una conexión con la base de datos Firestore.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-4">
              <pre className="text-sm text-destructive whitespace-pre-wrap">
                <code>{dbError.message}</code>
              </pre>
            </div>
             <p className="mt-4 text-xs text-muted-foreground">
                Por favor, verifica la configuración de tu proyecto Firebase y las reglas de seguridad de Firestore.
            </p>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card className="border-green-500/50">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <div className="flex-1">
            <CardTitle className="text-green-600">Conexión Exitosa con Firestore</CardTitle>
            <CardDescription>
              Conectado exitosamente a Firestore y configuración obtenida.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm font-medium">
            Datos de la colección `configurations`:
          </p>
          <div className="rounded-md bg-muted p-4">
            <pre className="text-sm text-foreground">
              <code>{JSON.stringify(dbResult, null, 2) || "No se encontró documento de configuración."}</code>
            </pre>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Prueba de Conexión de Base de Datos"
        description="Página de diagnóstico para verificar la conexión entre la app y Firestore."
      />
      {renderContent()}
    </main>
  );
}
