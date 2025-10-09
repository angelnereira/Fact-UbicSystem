
"use client";

import * as React from "react";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc } from "firebase/firestore";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

// Zod Schema for the configuration form
const configSchema = z.object({
  companyName: z.string().min(1, "El nombre de la empresa es requerido."),
  companyRuc: z.string().min(1, "El RUC de la empresa es requerido."),
  webhookIdentifier: z.string().min(3, "El identificador debe tener al menos 3 caracteres.").regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones."),
  demoUser: z.string().optional(),
  demoPass: z.string().optional(),
  demoRuc: z.string().optional(),
  demoDv: z.string().optional(),
  prodUser: z.string().optional(),
  prodPass: z.string().optional(),
  prodRuc: z.string().optional(),
  prodDv: z.string().optional(),
});

type ConfigFormValues = z.infer<typeof configSchema>;

type Configuration = ConfigFormValues & { id: string };

// --- Custom hook to get configurations ---
function useConfigurations() {
    const firestore = useFirestore();
    const [configs, setConfigs] = React.useState<Configuration[]>([]);
    const [loading, setLoading] = React.useState(true);

    const configsQuery = useMemoFirebase(
        () => firestore ? collection(firestore, "configurations") : null,
        [firestore]
    );

    React.useEffect(() => {
        if (!configsQuery) return;
        const unsubscribe = onSnapshot(configsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Configuration));
            setConfigs(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [configsQuery]);
    
    return { configs, loading };
}


// --- Main Settings Page Component ---
export default function SettingsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { configs, loading: loadingConfigs } = useConfigurations();
  const [selectedConfigId, setSelectedConfigId] = React.useState<string | undefined>();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      companyName: "",
      companyRuc: "",
      webhookIdentifier: "",
    }
  });

  const selectedConfig = React.useMemo(() => {
    return configs.find(c => c.id === selectedConfigId);
  }, [configs, selectedConfigId]);

  React.useEffect(() => {
    if (selectedConfig) {
      form.reset(selectedConfig);
    } else {
      form.reset({
        companyName: "",
        companyRuc: "",
        webhookIdentifier: "",
        demoUser: "", demoPass: "", demoRuc: "", demoDv: "",
        prodUser: "", prodPass: "", prodRuc: "", prodDv: "",
      });
    }
  }, [selectedConfig, form]);
  
  React.useEffect(() => {
    if(!selectedConfigId && configs.length > 0) {
      setSelectedConfigId(configs[0].id);
    }
  }, [configs, selectedConfigId]);


  async function onSubmit(data: ConfigFormValues) {
    if (!firestore) return;

    try {
        let docId = selectedConfigId;
        if (docId) {
            // Update existing document
            const configRef = doc(firestore, "configurations", docId);
            await setDoc(configRef, data, { merge: true });
        } else {
            // Create new document
            const newDocRef = await addDoc(collection(firestore, "configurations"), data);
            setSelectedConfigId(newDocRef.id);
            docId = newDocRef.id;
        }
      
      toast({
        title: "Configuración Guardada",
        description: `La configuración para "${data.companyName}" ha sido guardada.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al Guardar",
        description: error.message,
      });
    }
  }

  async function handleDelete() {
    if (!firestore || !selectedConfigId) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, "configurations", selectedConfigId));
        toast({
            title: "Configuración Eliminada",
            description: "La configuración ha sido eliminada exitosamente."
        });
        setSelectedConfigId(undefined);
    } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Error al Eliminar",
            description: error.message,
        });
    } finally {
        setIsDeleting(false);
    }
  }

  const handleCreateNew = () => {
    setSelectedConfigId(undefined);
    form.reset({ companyName: "", companyRuc: "", webhookIdentifier: "" });
  }

  const webhookUrl = selectedConfig?.webhookIdentifier 
    ? `${window.location.origin}/api/webhooks/invoices/${selectedConfig.webhookIdentifier}`
    : null;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Gestión de Configuraciones"
        description="Crea, edita y gestiona las configuraciones para cada cliente de HKA."
      />
      
       <Card>
          <CardHeader className="flex-row items-center justify-between">
              <div className="space-y-1.5">
                  <CardTitle>Seleccionar Configuración</CardTitle>
                  <CardDescription>
                      Elige una configuración para ver o editar, o crea una nueva.
                  </CardDescription>
              </div>
              <Button variant="outline" onClick={handleCreateNew}><PlusCircle className="mr-2"/> Crear Nueva</Button>
          </CardHeader>
          <CardContent>
            {loadingConfigs ? <Skeleton className="h-10 w-full" /> : (
              <Select onValueChange={setSelectedConfigId} value={selectedConfigId}>
                <SelectTrigger>
                    <SelectValue placeholder="Selecciona un cliente..." />
                </SelectTrigger>
                <SelectContent>
                    {configs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                            {config.companyName} ({config.companyRuc})
                        </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
      </Card>
      
      {(selectedConfigId || !selectedConfigId) && (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs defaultValue="company">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="company">Datos de Empresa</TabsTrigger>
                        <TabsTrigger value="demo">Credenciales Demo</TabsTrigger>
                        <TabsTrigger value="prod">Credenciales Prod</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="company">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información General</CardTitle>
                                <CardDescription>Datos principales de la empresa y endpoint del webhook.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="companyName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre de la Empresa</FormLabel>
                                        <FormControl><Input placeholder="Mi Empresa S.A." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name="companyRuc" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>RUC de la Empresa</FormLabel>
                                        <FormControl><Input placeholder="1234567-1-123456" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name="webhookIdentifier" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Identificador para Webhook</FormLabel>
                                        <FormControl><Input placeholder="mi-empresa-slug" {...field} /></FormControl>
                                        <FormDescription>
                                            {webhookUrl ? (
                                                <>URL del Webhook: <code className="bg-muted p-1 rounded">{webhookUrl}</code></>
                                            ) : "Identificador único para la URL del webhook."}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="demo">
                        <Card>
                            <CardHeader>
                                <CardTitle>Credenciales de Ambiente Demo</CardTitle>
                                <CardDescription>Credenciales proporcionadas por The Factory HKA para el entorno de pruebas.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="demoUser" render={({ field }) => (<FormItem><FormLabel>Usuario Demo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="demoPass" render={({ field }) => (<FormItem><FormLabel>Clave Demo</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="demoRuc" render={({ field }) => (<FormItem><FormLabel>RUC Emisor Demo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="demoDv" render={({ field }) => (<FormItem><FormLabel>DV Emisor Demo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            </CardContent>
                        </Card>
                    </TabsContent>

                     <TabsContent value="prod">
                        <Card>
                            <CardHeader>
                                <CardTitle>Credenciales de Ambiente de Producción</CardTitle>
                                <CardDescription>Credenciales proporcionadas por The Factory HKA para el entorno productivo. ¡Manejar con cuidado!</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="prodUser" render={({ field }) => (<FormItem><FormLabel>Usuario Producción</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="prodPass" render={({ field }) => (<FormItem><FormLabel>Clave Producción</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="prodRuc" render={({ field }) => (<FormItem><FormLabel>RUC Emisor Producción</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="prodDv" render={({ field }) => (<FormItem><FormLabel>DV Emisor Producción</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                <div className="flex justify-between items-center">
                    <div>
                        {selectedConfigId && (
                           <AlertDialog>
                               <AlertDialogTrigger asChild>
                                    <Button type="button" variant="destructive" disabled={isDeleting}>
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4"/>}
                                        Eliminar
                                    </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                   <AlertDialogHeader>
                                       <AlertDialogTitle>¿Estás seguro de eliminar esta configuración?</AlertDialogTitle>
                                       <AlertDialogDescription>
                                            Esta acción no se puede deshacer. Se eliminará permanentemente la configuración para <strong>{selectedConfig?.companyName}</strong>.
                                       </AlertDialogDescription>
                                   </AlertDialogHeader>
                                   <AlertDialogFooter>
                                       <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                       <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Confirmar</AlertDialogAction>
                                   </AlertDialogFooter>
                               </AlertDialogContent>
                           </AlertDialog>
                        )}
                    </div>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {selectedConfigId ? 'Guardar Cambios' : 'Crear Configuración'}
                    </Button>
                </div>
            </form>
        </Form>
      )}
    </main>
  );
}
