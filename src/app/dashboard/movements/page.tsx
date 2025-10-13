
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  FileText,
  Loader2,
  Search,
  Calendar as CalendarIcon,
} from "lucide-react";
import { collection, query, orderBy, limit, where, Timestamp, onSnapshot, updateDoc, doc, addDoc } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { timbrar } from "@/lib/hka/actions";
import { HkaError } from "@/lib/hka/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";


type InvoiceSubmission = {
  id: string;
  submissionDate: string;
  status: 'pending' | 'certified' | 'failed' | 'error';
  invoiceData: string; // JSON string
  configId: string;
  source: 'manual' | 'webhook';
  hkaResponseId?: string;
};

// A custom hook to fetch and subscribe to a collection
function useCollection<T extends {id: string}>(q: any) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!q) {
      setData(null);
      setIsLoading(false);
      return;
    }
    const unsub = onSnapshot(
      q,
      (snap: any) => {
        const docs = snap.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
        setData(docs as T[]);
        setIsLoading(false);
        setError(null);
      },
      (err: any) => {
        setError(err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [q]);

  return { data, isLoading, error };
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
  activeEnvironment: process.env.NEXT_PUBLIC_HKA_ENV || "desconocido",
  latency: 0,
  errorRate: 0,
};


export default function MovementsPage() {
  const { toast } = useToast();
  
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState<DateRange | undefined>();
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  const firestore = useFirestore();

  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
  
    const filters = [];
  
    if (filterStatus !== 'all') {
      filters.push(where("status", "==", filterStatus));
    }
  
    if (filterDate?.from) {
      const fromTimestamp = Timestamp.fromDate(filterDate.from);
      filters.push(where("submissionDate", ">=", fromTimestamp.toDate().toISOString()));
    }
    if (filterDate?.to) {
        const toDate = new Date(filterDate.to);
        toDate.setHours(23, 59, 59, 999);
        const toTimestamp = Timestamp.fromDate(toDate);
        filters.push(where("submissionDate", "<=", toTimestamp.toDate().toISOString()));
    }
  
    return query(
      collection(firestore, "invoiceSubmissions"),
      ...filters,
      orderBy("submissionDate", "desc"),
      limit(50)
    );
  }, [firestore, filterStatus, filterDate]);
  
  const { data: rawMovements, isLoading } = useCollection<InvoiceSubmission>(submissionsQuery);

  const movements = useMemo(() => {
    if (!rawMovements) return [];
    if (!filterText) return rawMovements;

    return rawMovements.filter(mov => {
        try {
            const invoice = JSON.parse(mov.invoiceData);
            const searchableFields = [
              invoice.externalId,
              invoice.customerName,
              invoice.customerRuc,
              mov.id
            ].filter(Boolean);

            return searchableFields.some(field => 
              field.toLowerCase().includes(filterText.toLowerCase())
            );
        } catch {
            return mov.id.toLowerCase().includes(filterText.toLowerCase());
        }
    })
  }, [rawMovements, filterText]);


  const handleRetry = async (submission: InvoiceSubmission) => {
    if (!firestore) return;
    setIsRetrying(submission.id);
    toast({
        title: "Reintentando envío...",
        description: `Volviendo a enviar la factura con ID: ${submission.id}`
    });
    
    const submissionDocRef = doc(firestore, 'invoiceSubmissions', submission.id);

    try {
        const invoicePayload = JSON.parse(submission.invoiceData);
        // We assume 'demo' for retries for safety, this could be configurable
        const hkaResponse = await timbrar(invoicePayload, submission.configId, 'demo'); 

        const hkaResponsesRef = collection(firestore, 'hkaResponses');
        const hkaResponseRecord = {
          responseDate: new Date().toISOString(),
          statusCode: 200,
          responseBody: JSON.stringify(hkaResponse),
          invoiceSubmissionId: submission.id,
        };
        const hkaResponseDocRef = await addDoc(hkaResponsesRef, hkaResponseRecord);

        await updateDoc(submissionDocRef, {
            status: 'certified',
            hkaResponseId: hkaResponseDocRef.id
        });

        toast({
            title: "Reintento Exitoso",
            description: "La factura ha sido timbrada correctamente."
        });

    } catch (error: any) {
        await updateDoc(submissionDocRef, {
            status: 'failed',
        });
        toast({
            variant: "destructive",
            title: "Fallo el Reintento",
            description: error.message || "No se pudo completar el reintento."
        });
    } finally {
        setIsRetrying(null);
    }
  }

  const renderTableContent = () => {
    if (isLoading) {
      return Array.from({ length: 5 }).map((_, i) => (
         <TableRow key={`skl-${i}`}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
        </TableRow>
      ));
    }

    if (!movements || movements.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={4} className="h-24 text-center">
            <div>No hay movimientos que coincidan con tu búsqueda.</div>
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
            <Badge
              variant={statusBadgeVariants[mov.status] || 'secondary'}
              className={cn(statusBadgeStyles[mov.status], 'border')}
            >
              {statusTranslations[mov.status] || mov.status}
            </Badge>
          </TableCell>
          <TableCell className="font-mono text-xs">
            {details}
          </TableCell>
          <TableCell className="text-right">
             <Dialog>
                 <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="mr-2">
                        <Info className="h-4 w-4 mr-1" /> Ver
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalles de la Sumisión</DialogTitle>
                        <DialogDescription>ID: {mov.id}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 max-h-[60vh] overflow-y-auto">
                        <div>
                            <h3 className="font-semibold mb-2">Datos Enviados</h3>
                            <pre className="p-2 bg-muted rounded-md text-xs">
                                {JSON.stringify(JSON.parse(mov.invoiceData), null, 2)}
                            </pre>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">Respuesta de HKA</h3>
                            <p className="text-sm text-muted-foreground">La visualización de la respuesta de HKA no está implementada.</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {(mov.status === "failed" || mov.status === "error") && (
              <Button 
                variant="outline" 
                size="sm" 
                disabled={isRetrying === mov.id}
                onClick={() => handleRetry(mov)}
              >
                {isRetrying === mov.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4 mr-1" />}
                {isRetrying === mov.id ? "" : "Reintentar"}
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
        description="Supervisa la salud y la actividad de la integración con HKA."
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
          value={"N/A"}
          icon={FileText}
          description="Consulte en la página de configuración."
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
          <CardTitle>Filtrar Movimientos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, ID externo, cliente o RUC..."
              className="pl-9"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="certified">Certificada</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="failed">Fallido</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal md:w-[300px]",
                  !filterDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filterDate?.from ? (
                  filterDate.to ? (
                    <>
                      {format(filterDate.from, "LLL dd, y")} -{" "}
                      {format(filterDate.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(filterDate.from, "LLL dd, y")
                  )
                ) : (
                  <span>Seleccionar fecha</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={filterDate?.from}
                selected={filterDate}
                onSelect={setFilterDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button onClick={() => {
            setFilterText('');
            setFilterStatus('all');
            setFilterDate(undefined);
          }} variant="ghost">Limpiar filtros</Button>
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
    