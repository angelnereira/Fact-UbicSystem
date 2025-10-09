
'use client';
import * as React from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, limit, getDocs, doc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

export default function TestDbPage() {
  const firestore = useFirestore();

  // This component tests the database connection by attempting to read a single
  // document from the 'invoiceSubmissions' collection.
  const [testDocId, setTestDocId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!firestore) return;
    const getOneDoc = async () => {
        try {
            const q = query(collection(firestore, "invoiceSubmissions"), limit(1));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                setTestDocId(snapshot.docs[0].id);
            }
        } catch (e) {
            // Error will be handled by the useDoc hook below
            console.error("Error fetching a test document ID:", e);
        }
    };
    getOneDoc();
  }, [firestore]);


  const submissionDocRef = useMemoFirebase(
    () =>
      firestore && testDocId
        ? doc(firestore, "invoiceSubmissions", testDocId)
        : null,
    [firestore, testDocId]
  );

  const { data: dbResult, isLoading, error: dbError } = useDoc(submissionDocRef);


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
              Conectado exitosamente a Firestore. Se probó leyendo la colección 'invoiceSubmissions'.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm font-medium">
            Último envío de factura encontrado:
          </p>
          <div className="rounded-md bg-muted p-4">
            <pre className="text-sm text-foreground overflow-auto">
              <code>{JSON.stringify(dbResult, null, 2) || "No se encontraron documentos en 'invoiceSubmissions', pero la conexión fue exitosa."}</code>
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
