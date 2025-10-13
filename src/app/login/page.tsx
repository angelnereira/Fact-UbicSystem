"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Por favor, ingresa un correo válido."),
  password: z.string().min(1, "La contraseña no puede estar vacía."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
        <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-76.2 64.5C308.6 102.3 279.2 92 248 92c-88.8 0-160.1 71.1-160.1 164s71.3 164 160.1 164c94.4 0 140.3-61.5 143.8-92.6H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
    </svg>
);


export default function LoginPage() {
  const { auth, isUserLoading } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  
  const handleAuthSuccess = (action: string) => {
    toast({
      title: `${action} Exitoso`,
      description: "Bienvenido a Fact-UbicSystem.",
    });
    router.push('/dashboard');
  }

  const handleAuthError = (error: any, action: string) => {
    console.error(`Error de ${action}:`, error);
    toast({
      variant: "destructive",
      title: `Error de ${action}`,
      description: "Las credenciales son incorrectas o ha ocurrido un error. Por favor, inténtalo de nuevo.",
    });
  }

  const onEmailSubmit = async (data: LoginFormValues) => {
    if (!auth) return;
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      handleAuthSuccess("Inicio de Sesión");
    } catch (error: any) {
      handleAuthError(error, "autenticación");
    }
  };

  const signInWithGoogle = async () => {
    if (!auth) return;
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        handleAuthSuccess("Inicio de Sesión con Google");
    } catch (error: any) {
        handleAuthError(error, "autenticación con Google");
    }
  }
  
  if (isUserLoading) {
     return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
           <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl">Bienvenido</CardTitle>
          <CardDescription>
            Inicia sesión para acceder a tu dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-2">
             <Button className="w-full" onClick={signInWithGoogle}>
                <GoogleIcon />
                Continuar con Google
            </Button>
            <Button variant="outline" className="w-full" disabled>
                Continuar con Teléfono
            </Button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                    O continúa con tu correo
                </span>
            </div>
           </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                 {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ingresar con Correo
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
