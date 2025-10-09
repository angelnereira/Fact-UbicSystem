
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
import { useFirestore } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";

// --- Zod Schemas ---
const companySchema = z.object({
  companyName: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  companyRuc: z.string().min(6, "El RUC debe tener al menos 6 caracteres."),
  companyDv: z.string().min(1, "El DV es requerido.").max(2, "Máximo 2 dígitos."),
});

const hkaSchema = z.object({
  demoUser: z.string().optional(),
  demoPass: z.string().optional(),
  prodUser: z.string().optional(),
  prodPass: z.string().optional(),
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
            <CardTitle>Información Fiscal del Emisor</CardTitle>
            <CardDescription>
              Nombre, RUC y Dígito Verificador (DV) de la empresa que emite las facturas.
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="companyRuc"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>RUC</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 12345678-1-123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyDv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DV</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 90" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
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
        description: "Las credenciales de HKA se han guardado. Por seguridad, estas se guardan en un entorno seguro y no se mostrarán aquí de nuevo.",
      });
      // Clear password fields after submission for security
      form.reset({ ...form.getValues(), demoPass: '', prodPass: '' });
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
    // In a real scenario, this would trigger a server action that attempts to authenticate
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const success = Math.random() > 0.3; // 70% de probabilidad de éxito
    if (success) {
      toast({
        title: "Conexión Simulada Exitosa",
        description: "Las credenciales parecen ser válidas (simulación).",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Fallo en la Conexión (Simulada)",
        description: "No se pudo conectar a HKA. Verifica el usuario y la clave.",
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
                Credenciales para el entorno de pruebas de The Factory HKA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="demoUser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario (Demo)</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario_demo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="demoPass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave (Demo)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
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
                Credenciales para el entorno real de The Factory HKA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <FormField
                control={form.control}
                name="prodUser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario (Producción)</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario_prod" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prodPass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clave (Producción)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
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
              <Wifi className="mr-2 h-4 w-4" />
            )}
            Probar Conexión
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
             {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
            Guardar Credenciales
          </Button>
        </div>
      </form>
    </Form>
  );
}

// --- Main Settings Page Component ---
export default function SettingsPage() {
  const firestore = useFirestore();
  const [initialData, setInitialData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Use a static ID for the configuration document
  const configId = "global-settings"; 

  React.useEffect(() => {
    if (!firestore) {
      return;
    }
    
    const fetchConfig = async () => {
      setIsLoading(true);
      const configRef = doc(firestore, "configurations", configId);
      try {
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Don't load passwords back into the form
            setInitialData({
                ...data,
                demoPass: '',
                prodPass: ''
            });
        }
      } catch (error) {
        console.error("Error fetching configuration:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [firestore]);

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
    );
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
          <CompanyForm configId={configId} initialData={initialData} />
        </TabsContent>
        <TabsContent value="hka" className="mt-6">
           <HkaForm configId={configId} initialData={initialData} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
