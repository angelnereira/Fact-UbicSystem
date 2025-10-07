

"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";

import { useFirestore, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking, useMemoFirebase } from "@/firebase";
import { collection, query, limit, doc } from "firebase/firestore";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const settingsSchema = z
  .object({
    companyName: z.string().optional(),
    taxId: z.string().optional(),
    fiscalAddress: z.string().optional(),
    webhookIdentifier: z.string().min(3, "El identificador debe tener al menos 3 caracteres.").regex(/^[a-z0-9-]+$/, "Usa solo letras minúsculas, números y guiones."),
    
    demoEnabled: z.boolean(),
    demoTokenEmpresa: z.string(),
    demoTokenPassword: z.string(),
    demoApiUrl: z.string().url("Debe ser una URL válida."),

    prodEnabled: z.boolean(),
    prodTokenEmpresa: z.string(),
    prodTokenPassword: z.string(),
    prodApiUrl: z.string().url("Debe ser una URL válida."),
  })
  .refine(
    (data) => {
      // If demo is enabled, its tokens are required
      if (data.demoEnabled && (!data.demoTokenEmpresa || !data.demoTokenPassword)) {
        return false;
      }
      return true;
    },
    {
      message: "Las credenciales de Demo son requeridas cuando el ambiente está activado.",
      path: ["demoTokenEmpresa"], // you can point to a specific field
    }
  ).refine(
     (data) => {
      if (data.prodEnabled && (!data.prodTokenEmpresa || !data.prodTokenPassword)) {
        return false;
      }
      return true;
    },
    {
      message: "Las credenciales de Producción son requeridas cuando el ambiente está activado.",
      path: ["prodTokenEmpresa"],
    }
  )
  .refine((data) => !(data.demoEnabled && data.prodEnabled), {
    message: "Solo un ambiente (Demo o Producción) puede estar activo a la vez.",
    path: ["prodEnabled"], // Point error to the second switch
  });

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"success" | "error" | null>(null);
  
  // Hook para leer la configuración de Firestore
  const configurationsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, "configurations"), limit(1)) : null,
    [firestore]
  );
  const { data: configData, isLoading: isConfigLoading } = useCollection<SettingsFormValues>(configurationsQuery);
  const existingConfig = configData?.[0];

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: "",
      taxId: "",
      fiscalAddress: "",
      webhookIdentifier: "",
      demoEnabled: true,
      demoTokenEmpresa: "",
      demoTokenPassword: "",
      demoApiUrl: "https://api.hka.demo.example",
      prodEnabled: false,
      prodTokenEmpresa: "",
      prodTokenPassword: "",
      prodApiUrl: "https://api.hka.production.example",
    },
  });

  // Efecto para popular el formulario cuando los datos de Firestore cargan
  useEffect(() => {
    if (existingConfig) {
      form.reset(existingConfig);
    }
  }, [existingConfig, form]);


  async function onSubmit(data: SettingsFormValues) {
    if (!firestore) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo conectar a la base de datos."
        })
        return;
    }

    try {
        if (existingConfig?.id) {
            // Si ya existe una configuración, la actualizamos
            const configDocRef = doc(firestore, "configurations", existingConfig.id);
            await updateDocumentNonBlocking(configDocRef, data);
        } else {
            // Si no existe, creamos una nueva
            const configurationsCollection = collection(firestore, "configurations");
            await addDocumentNonBlocking(configurationsCollection, data);
        }

        toast({
          title: "¡Configuración Guardada!",
          description: "Tu información de empresa y HKA ha sido actualizada.",
        });

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Error al Guardar",
            description: error.message || "No se pudo guardar la configuración."
        });
    }
  }
  
  const handleValidateConnection = async () => {
      setIsConnecting(true);
      setConnectionStatus(null);
      
      // Simulate API call to HKA module
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const isSuccess = Math.random() > 0.3; // 70% chance of success
      setConnectionStatus(isSuccess ? 'success' : 'error');
      
      toast({
          title: isSuccess ? "Conexión Exitosa" : "Conexión Fallida",
          description: isSuccess ? "Conectado exitosamente a The Factory HKA." : "Credenciales inválidas o API no accesible.",
          variant: isSuccess ? "default" : "destructive",
      });
      
      setIsConnecting(false);
  }
  
  if(isConfigLoading) {
    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
            <PageHeader
                title="Configuración"
                description="Configura los detalles de tu empresa y las credenciales de HKA."
            />
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Configuración"
        description="Configura los detalles de tu empresa y las credenciales de HKA."
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Empresa</CardTitle>
              <CardDescription>
                Actualiza los detalles generales, fiscales y del webhook de tu empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Empresa</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Fiscal (RFC)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
               <FormField
                  control={form.control}
                  name="fiscalAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección Fiscal</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="webhookIdentifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identificador del Webhook</FormLabel>
                      <div className="flex items-center">
                        <span className="rounded-l-md border border-r-0 bg-muted px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                          URL del Webhook:
                        </span>
                        <FormControl>
                          <Input className="rounded-l-none" placeholder="mi-empresa-unica" {...field} />
                        </FormControl>
                      </div>
                      <FormDescription>
                        Este es el slug único para tu URL de webhook. Solo letras minúsculas, números y guiones.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credenciales HKA</CardTitle>
              <CardDescription>
                Gestiona tu conexión a The Factory HKA.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="demo">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="demo">Ambiente de Demo</TabsTrigger>
                  <TabsTrigger value="prod">Ambiente de Producción</TabsTrigger>
                </TabsList>
                <TabsContent value="demo" className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="demoEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Activar Ambiente de Demo
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="demoTokenEmpresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="demo-token-empresa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="demoTokenPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="demoApiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de API de Demo</FormLabel>
                        <FormControl>
                          <Input placeholder="https://api.hka.demo.example" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                <TabsContent value="prod" className="mt-4 space-y-4">
                   <FormField
                    control={form.control}
                    name="prodEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Activar Ambiente de Producción
                          </FormLabel>
                           <FormMessage className="text-xs" />
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="prodTokenEmpresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="prod-token-empresa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="prodTokenPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="prodApiUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de API de Producción</FormLabel>
                        <FormControl>
                          <Input placeholder="https://api.hka.production.example" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>
               <div className="mt-6 flex items-center gap-4">
                <Button type="button" variant="outline" onClick={handleValidateConnection} disabled={isConnecting}>
                    {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Validar Conexión
                </Button>
                {connectionStatus === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
                {connectionStatus === 'error' && <AlertTriangle className="h-6 w-6 text-red-500" />}
               </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
             <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
             </Button>
          </div>
        </form>
      </Form>
    </main>
  );
}

    
