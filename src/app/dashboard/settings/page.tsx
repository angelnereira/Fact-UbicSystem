
"use client";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function SettingsPage() {
  const codeSnippet = `
# apphosting.yaml

runConfig:
  # ...
env:
  # Variable pública para el ambiente (demo o prod)
  - variable: NEXT_PUBLIC_HKA_ENV
    value: "demo" 
    availability: [BUILD, RUNTIME]

  # URLs base para los ambientes (solo en el servidor)
  - variable: HKA_API_BASE_DEMO
    value: "https://url.de.tu.api.demo"
    availability: [RUNTIME]
  - variable: HKA_API_BASE_PROD
    value: "https://url.de.tu.api.prod"
    availability: [RUNTIME]

  # Llave de API para el ambiente de demo (secreto)
  - variable: HKA_API_KEY_DEMO
    secret: HKA_API_KEY_DEMO # Nombre del secreto en Secret Manager
    availability: [RUNTIME]

  # Llave de API para el ambiente de producción (secreto)
  - variable: HKA_API_KEY_PROD
    secret: HKA_API_KEY_PROD
    availability: [RUNTIME]
  `;

  const cliCommand = `firebase apphosting:secrets:set HKA_API_KEY_DEMO`;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Configuración de Variables de Entorno"
        description="Gestiona la configuración de HKA a través de variables de entorno y secretos."
      />

      <Card>
        <CardHeader>
          <CardTitle>Gestión de Credenciales</CardTitle>
          <CardDescription>
            Las credenciales de The Factory HKA y otras configuraciones ya no se
            gestionan desde esta interfaz. Para mayor seguridad y flexibilidad,
            toda la configuración se realiza a través de variables de entorno y
            secretos en el archivo <strong>apphosting.yaml</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>Paso 1: Gestionar Secretos</AlertTitle>
            <AlertDescription>
              Usa el CLI de Firebase para guardar de forma segura tus
              credenciales. Por ejemplo, para guardar tu API key de demo:
              <pre className="mt-2 rounded-md bg-muted p-3 font-mono text-sm">
                <code>{cliCommand}</code>
              </pre>
              Se te pedirá que pegues el valor del secreto de forma segura en la
              terminal. Repite este paso para todas tus credenciales sensibles
              (ej. `HKA_API_KEY_PROD`).
            </AlertDescription>
          </Alert>

          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>Paso 2: Configurar apphosting.yaml</AlertTitle>
            <AlertDescription>
              Añade las variables y secretos a tu archivo `apphosting.yaml` para
              que el backend pueda acceder a ellos durante el despliegue.
              <pre className="mt-2 rounded-md bg-muted p-3 font-mono text-sm overflow-auto">
                <code>{codeSnippet.trim()}</code>
              </pre>
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            Después de configurar tu archivo `apphosting.yaml` y los secretos,
            despliega tu backend para que los cambios surtan efecto. La
            aplicación leerá automáticamente estas variables en el entorno
            desplegado.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
