
"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Copy,
  Info,
  RefreshCw,
  Server,
  FileText,
  Loader2,
} from "lucide-react";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { consultarFolios } from "@/lib/hka/client";

// Tipado para los datos que vienen de Firestore
type InvoiceSubmission = {
  id: string;
  submissionDate: string;
  status: 'pending' | 'certified' | 'failed' | 'error';
  invoiceData: string;
};

type Configuration = {
  id: string;
  webhookIdentifier?: string;
}

const statusTranslations: { [key: string]: string } = {
  pending: "Pendiente",
  certified: "Certificada",
  failed: "Fallido",
  error: "Error",
};

const statusBadgeVariants: { [key: string]: "default" | "destructive" | "secondary" } = {
  pending: "secondary",
  certified: "default",
  failed: "destructive",
  error: "destructive",
};

const statusBadgeStyles: { [key: string]: string } = {
  certified: "bg-green-100 text-green-800",
};


const mockApiHealth = {
  connectionStatus: "success",
  activeEnvironment: "demo",
  latency: 0,
  errorRate: 0,
};

export default function MovementsPage() {
  const { toast } = useToast();
  const [isAutomationOn, setIsAutomationOn] = useState(true);
  const [folios, setFolios] = useState(0);
  const [isLoadingFolios, setIsLoadingFolios] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  
  const firestore = useFirestore();

  // Lee la configuración para obtener el identificador del webhook
  const configurationsQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, "configurations"), limit(1)) : null,
    [firestore]
  );
  const { data: configData } = useCollection<Configuration>(configurationsQuery);
  const existingConfig = configData?.[0];

  useEffect(() => {
    if (existingConfig?.webhookIdentifier) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setWebhookUrl(`${origin}/api/webhooks/invoices/${existingConfig.webhookIdentifier}`);
    } else {
        setWebhookUrl("Aún no configurado. Guárdalo en la página de configuración.");
    }
}, [existingConfig]);


  useEffect(() => {
    async function fetchFolios() {
      setIsLoadingFolios(true);
      try {
        const remainingFolios = await consultarFolios();
        setFolios(remainingFolios);
      } catch (error) {
        console.error("Error al consultar folios en MovementsPage:", error);
        toast({
          variant: "destructive",
          title: "Error de Conexión",
          description: "No se pudieron obtener los folios. Verifica tu configuración de HKA.",
        });
        setFolios(0);
      } finally {
        setIsLoadingFolios(false);
      }
    }

    fetchFolios();
  }, [toast]);


  const submissionsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, "invoiceSubmissions"),
            orderBy("submissionDate", "desc"),
            limit(20)
          )
        : null,
    [firestore]
  );
  
  const { data: movements, isLoading } = useCollection<InvoiceSubmission>(submissionsQuery);

  const copyToClipboard = () => {
    if(webhookUrl.startsWith("http")) {
      navigator.clipboard.writeText(webhookUrl);
      toast({ title: "¡Copiado!", description: "URL del webhook copiada al portapapeles." });
    }
  };

  const renderTableContent = () => {
    if (isLoading) {
      return Array.from({ length: 5 }).map((_, i) => (
         <TableRow key={`skl-${i}`}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
        </TableRow>
      ));
    }

    if (!movements || movements.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center">
            <div>No hay movimientos registrados todavía.</div>
          </TableCell>
        </TableRow>
      );
    }
    
    return movements.map((mov) => {
      let details = "N/A";
      try {
        const invoice = JSON.parse(mov.invoiceData);
        details = `ID Ext: ${invoice.externalId || 'N/A'}`;
      } catch {}

      return (
        <TableRow key={mov.id}>
          <TableCell>
            {new Date(mov.submissionDate).toLocaleString()}
          </TableCell>
          <TableCell>
            <Badge variant="outline">Timbrar (Webhook)</Badge>
          </TableCell>
          <TableCell>
            <Badge
              variant={statusBadgeVariants[mov.status] || 'secondary'}
              className={statusBadgeStyles[mov.status]}
            >
              {statusTranslations[mov.status] || mov.status}
            </Badge>
          </TableCell>
          <TableCell className="font-mono text-xs">
            {details}
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm" className="mr-2">
              <Info className="h-4 w-4 mr-1" /> Ver
            </Button>
            {mov.status === "failed" && (
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" /> Reintentar
              </Button>
            )}
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <PageHeader
        title="Movimientos de Integración"
        description="Supervisa la salud y configura las fuentes de datos."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Estado de la API"
          value={
            mockApiHealth.connectionStatus === "success"
              ? "Conectado"
              : "Desconectado"
          }
          icon={
            mockApiHealth.connectionStatus === "success"
              ? CheckCircle
              : AlertTriangle
          }
          description={`Ambiente Activo: ${mockApiHealth.activeEnvironment}`}
          status={mockApiHealth.connectionStatus as "success" | "danger"}
        />
        <StatCard
          title="Folios Restantes"
          value={isLoadingFolios ? "Cargando..." : folios.toLocaleString()}
          icon={FileText}
          description="Folios disponibles para timbrar."
        />
        <StatCard
          title="Latencia de API"
          value={`${mockApiHealth.latency}ms`}
          icon={Activity}
          description={`Tasa de Error: ${mockApiHealth.errorRate}%`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Puntos de Entrada de Datos</CardTitle>
          <CardDescription>
            Configura cómo se envían las facturas a The Factory HKA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="webhook">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="webhook">Webhook</TabsTrigger>
              <TabsTrigger value="external_api">API Externa</TabsTrigger>
              <TabsTrigger value="db">DB</TabsTrigger>
              <TabsTrigger value="folder">Carpeta</TabsTrigger>
              <TabsTrigger value="ftp">FTP</TabsTrigger>
            </TabsList>
            <TabsContent value="webhook" className="mt-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="webhook-active"
                    checked={true}
                    disabled
                    aria-readonly
                  />
                  <Label htmlFor="webhook-active">Webhook Activo</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tu endpoint de webhook personalizado está listo para recibir facturas.
                </p>
                <div className="flex w-full max-w-lg items-center space-x-2">
                  <Input type="text" value={webhookUrl} readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                    disabled={!webhookUrl.startsWith("http")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="external_api" className="mt-4">
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <Server className="mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">
                  Configuración de API Externa
                </h3>
                <p className="text-sm text-muted-foreground">
                  Esta funcionalidad aún no está disponible.
                </p>
              </div>
            </TabsContent>
            {/* Other tabs are placeholders */}
            <TabsContent value="db" className="mt-4">
                 <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <Server className="mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">
                  Configuración de Base de Datos
                </h3>
                <p className="text-sm text-muted-foreground">
                  Esta funcionalidad aún no está disponible.
                </p>
              </div>
            </TabsContent>
             <TabsContent value="folder" className="mt-4">
                 <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <Server className="mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">
                  Configuración de Carpeta
                </h3>
                <p className="text-sm text-muted-foreground">
                  Esta funcionalidad aún no está disponible.
                </p>
              </div>
            </TabsContent>
             <TabsContent value="ftp" className="mt-4">
                 <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <Server className="mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">
                  Configuración de FTP
                </h3>
                <p className="text-sm text-muted-foreground">
                  Esta funcionalidad aún no está disponible.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Automatización</CardTitle>
          <CardDescription>
            Gestiona los parámetros de procesamiento automático de facturas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="automation-switch" className="text-base">
                Habilitar Envío Automático
              </Label>
              <p className="text-sm text-muted-foreground">
                Procesa automáticamente facturas desde los puntos de entrada configurados.
              </p>
            </div>
            <Switch
              id="automation-switch"
              checked={isAutomationOn}
              onCheckedChange={setIsAutomationOn}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frecuencia (minutos)</Label>
              <Input id="frequency" type="number" defaultValue="5" disabled={!isAutomationOn}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retries">Reintentos en caso de fallo</Label>
              <Input id="retries" type="number" defaultValue="3" disabled={!isAutomationOn}/>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registro de Movimientos</CardTitle>
          <CardDescription>
            Historial de las últimas interacciones con la API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Detalles</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTableContent()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
