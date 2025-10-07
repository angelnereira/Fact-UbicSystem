"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { PlusCircle, Trash2, Loader2, Upload } from "lucide-react";
import convert from "xml-js";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const invoiceFormSchema = z.object({
  externalId: z.string().min(1, {
    message: "El ID externo es requerido.",
  }),
  customerName: z.string().min(2, {
    message: "El nombre del cliente debe tener al menos 2 caracteres.",
  }),
  customerRuc: z.string().min(6, {
    message: "El RUC debe tener al menos 6 caracteres.",
  }),
  items: z
    .array(
      z.object({
        desc: z.string().min(1, "La descripción es requerida."),
        qty: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
        unitPrice: z.coerce.number().min(0.01, "El precio debe ser positivo."),
      })
    )
    .min(1, "Debes agregar al menos un ítem."),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

const defaultValues: Partial<InvoiceFormValues> = {
  items: [{ desc: "", qty: 1, unitPrice: 0 }],
};

export function InvoiceForm() {
  const { toast } = useToast();
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const xmlString = e.target?.result as string;
      try {
        const result = convert.xml2js(xmlString, { compact: true, spaces: 2 });
        const invoiceData = result.factura;
        
        form.setValue("externalId", invoiceData.encabezado.idExterno._text);
        form.setValue("customerName", invoiceData.cliente.nombre._text);
        form.setValue("customerRuc", invoiceData.cliente.ruc._text);

        remove(); // Limpia los items por defecto
        const items = Array.isArray(invoiceData.items.item) ? invoiceData.items.item : [invoiceData.items.item];
        
        items.forEach((item: any) => {
          append({
            desc: item.descripcion._text,
            qty: parseFloat(item.cantidad._text),
            unitPrice: parseFloat(item.precioUnitario._text),
          });
        });

        toast({
          title: "XML Cargado",
          description: "Los datos del archivo XML han sido cargados en el formulario.",
        });

      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error al leer XML",
          description: "El archivo XML no tiene el formato esperado o está corrupto.",
        });
        console.error("XML Parsing Error:", error);
      }
    };
    reader.readAsText(file);
  };

  async function onSubmit(data: InvoiceFormValues) {
    form.control.register('items'); // Ensure array is in form state
    const payload = { invoice: data };
    
    toast({
      title: "Enviando Factura...",
      description: "Enviando tu factura al webhook.",
    });

    try {
      // Simulate fetch to /api/webhooks/invoices
      const response = await fetch("/api/webhooks/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // In a real scenario, you might get a more detailed error
        const errorData = await response.json().catch(() => ({ message: 'Ocurrió un error desconocido' }));
        throw new Error(errorData.message || `La solicitud falló con estado ${response.status}`);
      }
      
      const result = await response.json();

      toast({
        title: "Factura Enviada Exitosamente",
        description: `Tu factura ha sido recibida. (ID: ${data.externalId})`,
      });
      console.log("Respuesta simulada:", result);
      form.reset();
    } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Envío Fallido",
          description: error.message || "No se pudo enviar la factura al webhook.",
      });
    }
  }

  const items = form.watch("items");
  const subtotal = items.reduce((acc, item) => {
    return acc + (item.qty || 0) * (item.unitPrice || 0);
  }, 0);
  const itbms = subtotal * 0.07;
  const total = subtotal + itbms;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
         <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="flex-grow space-y-4">
                <h3 className="text-lg font-medium">Cargar desde Archivo</h3>
                <div className="flex items-center gap-2">
                    <FormField
                    control={form.control}
                    name="externalId" // Campo dummy, no se usa directamente para el input de archivo
                    render={({ field }) => (
                        <FormItem className="w-full">
                        <FormLabel htmlFor="xml-upload" className="sr-only">Cargar XML</FormLabel>
                        <FormControl>
                            <Input id="xml-upload" type="file" accept=".xml,text/xml" onChange={handleFileChange} className="w-full" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="button" variant="outline" className="h-10 w-10 p-0" onClick={() => document.getElementById('xml-upload')?.click()}>
                        <Upload className="h-5 w-5" />
                    </Button>
                </div>
                <FormMessage />
            </div>
            <Separator orientation="vertical" className="mx-4 h-auto hidden md:block" />
            <Separator className="md:hidden"/>
            <div className="flex-grow w-full">
                <h3 className="text-lg font-medium mb-4">O llenar manualmente</h3>
                {/* Manual fields will go here, but for now we focus on XML */}
            </div>
        </div>
        
        <Separator />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
           <FormField
            control={form.control}
            name="externalId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID Externo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: ORD-12345" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="customerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Cliente</FormLabel>
                <FormControl>
                  <Input placeholder="ACME S.A.C" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="customerRuc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>RUC del Cliente</FormLabel>
                <FormControl>
                  <Input placeholder="20123456789" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div>
          <h3 className="text-lg font-medium mb-4">Ítems de la Factura</h3>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-12 gap-x-4 gap-y-2 items-start"
              >
                <div className="col-span-12 md:col-span-6">
                  <FormField
                    control={form.control}
                    name={`items.${index}.desc`}
                    render={({ field }) => (
                      <FormItem>
                         {index === 0 && <FormLabel>Descripción</FormLabel>}
                        <FormControl>
                          <Input placeholder="Ej: Servicios en la nube" {...field} />
                        </FormControl>
                         <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <FormField
                    control={form.control}
                    name={`items.${index}.qty`}
                    render={({ field }) => (
                      <FormItem>
                         {index === 0 && <FormLabel>Cantidad</FormLabel>}
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                         <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-5 md:col-span-3">
                  <FormField
                    control={form.control}
                    name={`items.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem>
                         {index === 0 && <FormLabel>Precio Unitario</FormLabel>}
                        <FormControl>
                          <Input type="number" placeholder="1500.00" step="0.01" {...field} />
                        </FormControl>
                         <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className={cn("col-span-3 md:col-span-1 flex items-center", index === 0 ? 'pt-8' : 'pt-2')}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => append({ desc: "", qty: 1, unitPrice: 0 })}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Agregar Ítem
          </Button>
        </div>

        <Separator />

        <div className="flex items-start justify-between">
            <div className="space-y-2">
                 <p className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-mono text-right w-24">${subtotal.toFixed(2)}</span>
                </p>
                 <p className="flex justify-between text-muted-foreground">
                    <span>ITBMS (7%):</span>
                    <span className="font-mono text-right w-24">${itbms.toFixed(2)}</span>
                </p>
                 <p className="flex justify-between text-xl font-bold">
                    <span>Total:</span>
                    <span className="font-mono text-right w-24">${total.toFixed(2)}</span>
                </p>
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Factura
            </Button>
        </div>
      </form>
    </Form>
  );
}
