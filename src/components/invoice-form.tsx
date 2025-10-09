"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfigurations } from "@/hooks/use-configurations";

const invoiceFormSchema = z.object({
  configId: z.string().min(1, "Debes seleccionar un cliente."),
  environment: z.enum(["demo", "prod"]),
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
  environment: "demo",
};

export function InvoiceForm() {
  const { toast } = useToast();
  const { configs, loading: loadingConfigs } = useConfigurations();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  async function onSubmit(data: InvoiceFormValues) {
    const { configId, environment, ...invoiceData } = data;
    
    toast({
      title: "Timbrando Factura...",
      description: "Enviando tu factura para ser procesada y timbrada.",
    });

    try {
      const response = await fetch(`/api/hka/timbrar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          invoice: invoiceData,
          configId,
          environment,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `La solicitud falló con estado ${response.status}`);
      }
      
      toast({
        title: "Factura Timbrada Exitosamente",
        description: `Factura con UUID: ${result.uuid}`,
      });

      form.reset(defaultValues);
      remove();
      append({ desc: "", qty: 1, unitPrice: 0 });

    } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Envío Fallido",
          description: error.message || "No se pudo enviar la factura para timbrar.",
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
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="configId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente HKA</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loadingConfigs}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el cliente emisor..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {configs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="environment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ambiente HKA</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el ambiente..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="prod">Producción</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
