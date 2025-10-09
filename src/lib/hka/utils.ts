
import convert from 'xml-js';

// Tipos para mejorar la legibilidad y el autocompletado
interface InvoiceItem {
  desc: string;
  qty: number;
  unitPrice: number;
}

interface InvoicePayload {
  externalId: string;
  customerName: string;
  customerRuc: string;
  items: InvoiceItem[];
}

interface EmisorConfig {
  ruc: string;
  dv: string;
  name?: string; // Nombre del emisor, opcional pero recomendado
  address?: string; // Dirección del emisor, opcional
}

/**
 * Genera el XML de la factura según el esquema de la DGI de Panamá.
 * @param payload - El objeto de la factura con los datos del cliente y los ítems.
 * @param emisor - La configuración de la empresa que emite la factura.
 * @returns Una cadena de texto con el XML de la factura.
 */
export function convertInvoiceToXml(payload: any, emisor: EmisorConfig): string {
  const invoice = payload as InvoicePayload;

  const now = new Date();
  const fechaEmision = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  let subtotal = 0;
  const itemsXml = invoice.items.map((item, index) => {
    const precioTotalItem = item.qty * item.unitPrice;
    subtotal += precioTotalItem;
    const itbmsItem = precioTotalItem * 0.07; // Asumimos 7% de ITBMS

    return {
      _attributes: { dSecItem: index + 1 },
      dDescProd: { _text: item.desc },
      dCantCodInt: { _text: item.qty },
      dPrUnit: { _text: item.unitPrice.toFixed(2) },
      dPrItem: { _text: precioTotalItem.toFixed(2) },
      gITBMSItem: {
        dTasaITBMS: { _text: 7.00 }, // Tasa fija del 7%
        dValITBMS: { _text: itbmsItem.toFixed(2) },
      },
    };
  });

  const totalItbms = subtotal * 0.07;
  const totalGeneral = subtotal + totalItbms;

  const jsonStructure = {
    _declaration: { _attributes: { version: '1.0', encoding: 'UTF-8' } },
    rFE: {
      _attributes: { dVerForm: "1.00" },
      dId: { _text: invoice.externalId },
      gDGen: {
        iDoc: { _text: "01" },
        dNroDF: { _text: invoice.externalId.replace(/\D/g, '').slice(-10) || '000000001' },
        dPtoFacDF: { _text: "001" },
        dFechaEm: { _text: fechaEmision },
        gEmis: {
          gRucEmi: {
            dRuc: { _text: emisor.ruc },
            dDV: { _text: emisor.dv },
          },
          dNombEm: { _text: emisor.name || "EMPRESA EMISORA SA" },
          dDirecEm: { _text: emisor.address || "CIUDAD DE PANAMA" },
        },
        gDatRec: {
          iTipoRec: { _text: "01" }, // Asumimos cliente final
          gRucRec: {
            dRuc: { _text: invoice.customerRuc },
            dDV: { _text: "00" }, // DV del receptor no suele ser mandatorio para el emisor
          },
          dNombRec: { _text: invoice.customerName },
        },
      },
      gItem: itemsXml,
      gTot: {
        dTotNeto: { _text: subtotal.toFixed(2) },
        dTotITBMS: { _text: totalItbms.toFixed(2) },
        dTotGravado: { _text: totalGeneral.toFixed(2) },
        dVTot: { _text: totalGeneral.toFixed(2) },
      },
    },
  };

  return convert.js2xml(jsonStructure, { compact: true, spaces: 2 });
}
