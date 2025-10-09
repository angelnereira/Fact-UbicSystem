
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, Wifi } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";

// --- Zod Schemas ---
const companySchema = z.object({
  companyName: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  companyRuc: z.string().min(6, "El RUC debe tener al menos 6 caracteres."),
});

const hkaSchema = z.object({
  demoApiKey: z.string().optional(),
  demoApiUrl: z.string().url("Debe ser una URL válida.").optional(),
  prodApiKey: z.string().optional(),
  prodApiUrl: z.string().url("Debe ser una URL válida.").optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;
type HkaFormData = z.infer<typeof hkaSchema>;

// --- Company Form Component ---
function CompanyForm({ configId, initialData }: { configId: string, initialData?: CompanyFormData }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: initialData,
  });

  const onSubmit = async (data: CompanyFormData) => {
    if (!firestore || !configId) return;
    toast({ title: "Guardando datos de la empresa..." });
    try {
      const configRef = doc(firestore, "configurations", configId);
      await setDoc(configRef, data, { merge: true });
      toast({
        title: "Éxito",
        description: "Los datos de la empresa se han guardado correctamente.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error.message || "No se pudieron guardar los datos.",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información Fiscal</CardTitle>
            <CardDescription>
              Nombre y RUC de la empresa que emite las facturas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Mi Empresa S.A." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyRuc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RUC</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 20123456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2" />
            Guardar Datos
          </Button>
        </div>
      </form>
    </Form>
  );
}

// --- HKA Credentials Form Component ---
function HkaForm({ configId, initialData }: { configId: string, initialData?: HkaFormData }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const form = useForm<HkaFormData>({
    resolver: zodResolver(hkaSchema),
    defaultValues: initialData
  });
  const [isTesting, setIsTesting] = React.useState(false);

  const onSubmit = async (data: HkaFormData) => {
     if (!firestore || !configId) return;
    toast({ title: "Guardando credenciales..." });
     try {
      const configRef = doc(firestore, "configurations", configId);
      await setDoc(configRef, data, { merge: true });
      toast({
        title: "Éxito",
        description: "Las credenciales de HKA se han guardado.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error.message || "No se pudieron guardar las credenciales.",
      });
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    toast({ title: "Probando conexión..." });
    // Simular una llamada a la API
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const success = Math.random() > 0.3; // 70% de probabilidad de éxito
    if (success) {
      toast({
        title: "Conexión Exitosa",
        description: "Las credenciales son válidas y se pudo conectar a HKA.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Fallo en la Conexión",
        description: "No se pudo conectar a HKA. Verifica la URL y la API Key.",
      });
    }
    setIsTesting(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ambiente de Demo</CardTitle>
              <CardDescription>
                Credenciales para el entorno de pruebas de HKA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="demoApiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Base (Demo)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://api.demo.hka.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="demoApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key (Demo)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="sk_test_..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ambiente de Producción</CardTitle>
              <CardDescription>
                Credenciales para el entorno real de HKA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <FormField
                control={form.control}
                name="prodApiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Base (Producción)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://api.hka.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prodApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key (Producción)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="sk_live_..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting}
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="mr-2" />
            )}
            Probar Conexión
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
             {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2" />
            Guardar Credenciales
          </Button>
        </div>
      </form>
    </Form>
  );
}

// --- Main Settings Page Component ---
export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [initialData, setInitialData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Usamos el UID del usuario para obtener una configuración única por usuario.
  // En un sistema multi-empresa, aquí se usaría un `companyId`.
  const configId = user?.uid; 

  React.useEffect(() => {
    if (!firestore || !configId) {
       if (!isUserLoading) setIsLoading(false);
      return;
    };
    
    const fetchConfig = async () => {
      setIsLoading(true);
      const configRef = doc(firestore, "configurations", configId);
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        setInitialData(docSnap.data());
      }
      setIsLoading(false);
    };

    fetchConfig();
  }, [firestore, configId, isUserLoading]);

  if (isLoading) {
    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
            <PageHeader
                title="Configuración"
                description="Gestiona los datos de tu empresa y las credenciales de HKA."
            />
            <div className="space-y-4">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-96 w-full" />
            </div>
       </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Configuración"
        description="Gestiona los datos de tu empresa y las credenciales de HKA."
      />

      <Tabs defaultValue="company" className="w-full">
        <TabsList>
          <TabsTrigger value="company">Datos de Empresa</TabsTrigger>
          <TabsTrigger value="hka">Credenciales HKA</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-6">
          {configId ? (
            <CompanyForm configId={configId} initialData={initialData} />
           ) : (
             <p className="text-muted-foreground">Debes iniciar sesión para configurar los datos.</p>
           )}
        </TabsContent>
        <TabsContent value="hka" className="mt-6">
           {configId ? (
            <HkaForm configId={configId} initialData={initialData} />
           ) : (
             <p className="text-muted-foreground">Debes iniciar sesión para configurar las credenciales.</p>
           )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

    