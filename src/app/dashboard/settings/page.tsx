

"use client";

import * as React from "react";
import { Loader2, PlusCircle, Trash2, CheckCircle, AlertCircle, Lock, Unlock } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useMemoFirebase, useAuth } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const configSchema = z.object({
  companyName: z.string().min(1, "El nombre de la empresa es requerido."),
  companyRuc: z.string().min(1, "El RUC de la empresa es requerido."),
  dv: z.string().min(1, "El DV es requerido."),
  webhookIdentifier: z.string().min(3, "El identificador debe tener al menos 3 caracteres.").regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones."),
  demoUser: z.string().optional(),
  demoPassword: z.string().optional(),
  prodUser: z.string().optional(),
  prodPassword: z.string().optional(),
});

const newUserSchema = z.object({
  username: z.string().min(2, "El nombre de usuario es requerido."),
  email: z.string().email("El correo no es válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

type ConfigFormValues = z.infer<typeof configSchema>;
type NewUserFormValues = z.infer<typeof newUserSchema>;

type Configuration = ConfigFormValues & { id: string };

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

export default function SettingsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { configs, loading: loadingConfigs } = useConfigurations();
  const [selectedConfigId, setSelectedConfigId] = React.useState<string | undefined>();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isCreatingUser, setIsCreatingUser] = React.useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = React.useState(false);
  const [isDemoLocked, setIsDemoLocked] = React.useState(true);
  const [isProdLocked, setIsProdLocked] = React.useState(true);


  const configForm = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      companyName: "",
      companyRuc: "",
      dv: "",
      webhookIdentifier: "",
    }
  });

  const newUserForm = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    }
  });


  const selectedConfig = React.useMemo(() => {
    return configs.find(c => c.id === selectedConfigId);
  }, [configs, selectedConfigId]);

  React.useEffect(() => {
    if (selectedConfig) {
      configForm.reset(selectedConfig);
    } else {
      configForm.reset({
        companyName: "", companyRuc: "", dv: "", webhookIdentifier: "",
        demoUser: "", demoPassword: "", prodUser: "", prodPassword: "",
      });
    }
    setIsDemoLocked(true);
    setIsProdLocked(true);
  }, [selectedConfig, configForm]);
  
  React.useEffect(() => {
    if(!selectedConfigId && configs.length > 0) {
      setSelectedConfigId(configs[0].id);
    }
  }, [configs, selectedConfigId]);

  async function onConfigSubmit(data: ConfigFormValues) {
    if (!firestore) return;

    try {
        let docId = selectedConfigId;
        if (docId) {
            const configRef = doc(firestore, "configurations", docId);
            await setDoc(configRef, data, { merge: true });
        } else {
            const newDocRef = await addDoc(collection(firestore, "configurations"), data);
            setSelectedConfigId(newDocRef.id);
            docId = newDocRef.id;
        }
      
      toast({
        title: "Configuración Guardada",
        description: `La configuración para "${data.companyName}" ha sido guardada.`,
      });
      setIsDemoLocked(true);
      setIsProdLocked(true);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al Guardar",
        description: error.message,
      });
    }
  }

  async function onNewUserSubmit(data: NewUserFormValues) {
    if (!auth || !firestore) return;
    setIsCreatingUser(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // Create user profile in Firestore
      await setDoc(doc(firestore, "users", user.uid), {
        email: user.email,
        name: data.username,
        role: "admin", // Default role
      });

      toast({
        title: "Usuario Creado",
        description: `El usuario ${data.username} ha sido creado exitosamente.`,
      });
      newUserForm.reset();
      setIsUserDialogOpen(false);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al Crear Usuario",
        description: error.message || "No se pudo completar el registro.",
      });
    } finally {
      setIsCreatingUser(false);
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

  async function handleValidateCredentials(environment: 'demo' | 'prod') {
      const values = configForm.getValues();
      const credentials = {
        usuario: environment === 'demo' ? values.demoUser : values.prodUser,
        clave: environment === 'demo' ? values.demoPassword : values.prodPassword,
      };

      if (!credentials.usuario || !credentials.clave) {
        toast({ variant: 'destructive', title: 'Faltan Credenciales', description: 'Por favor, ingresa el usuario y la clave.'});
        return;
      }
      
      setIsValidating(true);
      try {
        const response = await fetch('/api/hka/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ environment, ...credentials }),
        });
        
        const result = await response.json();

        if (!response.ok) throw new Error(result.message || 'Error desconocido');

        toast({
            title: "Conexión Exitosa",
            description: `Credenciales para el ambiente ${environment.toUpperCase()} son válidas.`,
            action: <div className="p-2 rounded-full bg-green-100"><CheckCircle className="text-green-600" /></div>,
        });

      } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Fallo en la Validación",
            description: error.message,
            action: <div className="p-2 rounded-full bg-red-100"><AlertCircle className="text-red-600" /></div>,
        });
      } finally {
        setIsValidating(false);
      }
  }


  const handleCreateNew = () => {
    setSelectedConfigId(undefined);
    configForm.reset({ companyName: "", companyRuc: "", dv: "", webhookIdentifier: "" });
  }

  const webhookUrl = selectedConfig?.webhookIdentifier 
    ? `${window.location.origin}/api/webhooks/invoices/${selectedConfig.webhookIdentifier}`
    : null;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Gestión de Clientes HKA"
        description="Crea, edita y gestiona las configuraciones para cada cliente de HKA."
      />
      
       <Card>
          <CardHeader className="flex-row items-center justify-between">
              <div className="space-y-1.5">
                  <CardTitle>Seleccionar Cliente</CardTitle>
                  <CardDescription>
                      Elige una configuración de cliente para ver, editar, o crea una nueva.
                  </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                 <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                    <DialogTrigger asChild>
                       <Button variant="outline"><PlusCircle className="mr-2"/> Crear Nuevo Usuario</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Registrar Nuevo Usuario Administrador</DialogTitle>
                            <DialogDescription>
                                Completa los datos para crear un nuevo usuario con acceso al sistema.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...newUserForm}>
                            <form onSubmit={newUserForm.handleSubmit(onNewUserSubmit)} className="space-y-4">
                               <FormField control={newUserForm.control} name="username" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre de Usuario</FormLabel>
                                        <FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={newUserForm.control} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Correo Electrónico</FormLabel>
                                        <FormControl><Input type="email" placeholder="ejemplo@correo.com" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={newUserForm.control} name="password" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contraseña</FormLabel>
                                        <FormControl><Input type="password" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <Button type="submit" disabled={isCreatingUser}>
                                    {isCreatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Crear Usuario
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
                <Button onClick={handleCreateNew}><PlusCircle className="mr-2"/> Crear Nuevo Cliente HKA</Button>
              </div>
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
      
      {(selectedConfigId !== undefined || configs.length === 0) && (
        <Form {...configForm}>
            <form onSubmit={configForm.handleSubmit(onConfigSubmit)} className="space-y-6">
                <Tabs defaultValue="company">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="company">Datos de Empresa</TabsTrigger>
                        <TabsTrigger value="demo">Credenciales Demo</TabsTrigger>
                        <TabsTrigger value="prod">Credenciales Prod</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="company">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información General del Cliente</CardTitle>
                                <CardDescription>Datos principales de la empresa y endpoint del webhook.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={configForm.control} name="companyName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre de la Empresa</FormLabel>
                                        <FormControl><Input placeholder="Mi Empresa S.A." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField control={configForm.control} name="companyRuc" render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>RUC de la Empresa</FormLabel>
                                            <FormControl><Input placeholder="1234567-1-123456" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={configForm.control} name="dv" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>DV</FormLabel>
                                            <FormControl><Input placeholder="90" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                <FormField control={configForm.control} name="webhookIdentifier" render={({ field }) => (
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
                                <CardDescription>Credenciales para el entorno de pruebas.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={configForm.control} name="demoUser" render={({ field }) => (<FormItem><FormLabel>Usuario (Demo)</FormLabel><FormControl><Input placeholder="proporcionado por HKA" {...field} disabled={isDemoLocked} /></FormControl><FormMessage /></FormItem>)}/>
                                    <FormField control={configForm.control} name="demoPassword" render={({ field }) => (<FormItem><FormLabel>Clave (Demo)</FormLabel><FormControl><Input type="password" placeholder="proporcionado por HKA" {...field} disabled={isDemoLocked} /></FormControl><FormMessage /></FormItem>)}/>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" onClick={() => handleValidateCredentials('demo')} disabled={isValidating}>
                                        {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Validar Credenciales Demo
                                    </Button>
                                    <Button type="button" size="icon" variant="ghost" onClick={() => setIsDemoLocked(prev => !prev)}>
                                        {isDemoLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                        <span className="sr-only">{isDemoLocked ? 'Desbloquear' : 'Bloquear'}</span>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                     <TabsContent value="prod">
                        <Card>
                            <CardHeader>
                                <CardTitle>Credenciales de Ambiente de Producción</CardTitle>
                                <CardDescription>Credenciales para el entorno productivo. ¡Manejar con cuidado!</CardDescription>
                            </CardHeader>
                             <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={configForm.control} name="prodUser" render={({ field }) => (<FormItem><FormLabel>Usuario (Producción)</FormLabel><FormControl><Input placeholder="proporcionado por HKA" {...field} disabled={isProdLocked} /></FormControl><FormMessage /></FormItem>)}/>
                                    <FormField control={configForm.control} name="prodPassword" render={({ field }) => (<FormItem><FormLabel>Clave (Producción)</FormLabel><FormControl><Input type="password" placeholder="proporcionado por HKA" {...field} disabled={isProdLocked} /></FormControl><FormMessage /></FormItem>)}/>
                                </div>
                                 <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" onClick={() => handleValidateCredentials('prod')} disabled={isValidating}>
                                        {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Validar Credenciales de Producción
                                    </Button>
                                    <Button type="button" size="icon" variant="ghost" onClick={() => setIsProdLocked(prev => !prev)}>
                                        {isProdLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                        <span className="sr-only">{isProdLocked ? 'Desbloquear' : 'Bloquear'}</span>
                                    </Button>
                                </div>
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
                    <Button type="submit" disabled={configForm.formState.isSubmitting}>
                        {configForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {selectedConfigId ? 'Guardar Cambios' : 'Crear Configuración'}
                    </Button>
                </div>
            </form>
        </Form>
      )}
    </main>
  );
}

    

    