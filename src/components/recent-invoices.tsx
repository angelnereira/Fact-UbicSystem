"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { cn } from "@/lib/utils";

// The full Invoice type might be more complex, but this covers the display needs.
export type RecentInvoice = {
  id: string;
  customerName: string;
  customerTaxId: string;
  total: number;
  status: "pending" | "certified" | "failed" | "error";
  createdAt: Date;
};

const statusStyles: { [key: string]: string } = {
  certified: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-800",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-800",
  error: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

const statusTranslations: { [key: string]: string } = {
  certified: "Timbrada",
  pending: "Pendiente",
  failed: "Falló",
  error: "Error",
};

type RecentInvoicesProps = {
  initialInvoices: RecentInvoice[];
};

export function RecentInvoices({ initialInvoices }: RecentInvoicesProps) {
  const [invoices, setInvoices] = useState<RecentInvoice[]>(initialInvoices);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const handleCancelClick = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setIsAlertOpen(true);
  };

  const handleCancelConfirm = () => {
    if (selectedInvoiceId) {
      // Here you would typically call an API to cancel the invoice.
      // For the UI, we'll just optimistically update the status.
      setInvoices((prevInvoices) =>
        prevInvoices.map((invoice) =>
          invoice.id === selectedInvoiceId
            ? { ...invoice, status: "failed" } // Or a new "cancelling" status
            : invoice
        )
      );
    }
    setIsAlertOpen(false);
    setSelectedInvoiceId(null);
  };
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Facturas Recientes</CardTitle>
          <CardDescription>
            Una lista de las facturas más recientes procesadas por el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden sm:table-cell">Estado</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
                <TableHead className="text-right">ID Externo</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Aún no hay facturas. Intenta crear una.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div className="font-medium">{invoice.customerName}</div>
                      <div className="hidden text-sm text-muted-foreground md:inline">
                        {invoice.customerTaxId}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={cn("capitalize", statusStyles[invoice.status])}>
                        {statusTranslations[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {invoice.createdAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {invoice.id}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Alternar menú</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleCancelClick(invoice.id)}
                            disabled={invoice.status === 'certified' || invoice.status === 'failed'}
                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Anular
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción intentará anular la factura {selectedInvoiceId} a través de HKA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Confirmar Anulación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
