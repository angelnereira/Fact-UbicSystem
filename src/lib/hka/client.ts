/**
 * @fileoverview
 * This module provides a client for interacting with The Factory HKA API.
 * It encapsulates API authentication, request retries with exponential backoff,
 * and provides simple, typed functions for common operations like stamping
 * (timbrar), querying status (consultarEstado), cancelling (anular), and
 * checking available folios (consultarFolios).
 */

// Since 'undici' is not available in the browser environment where this might run,
// we rely on the global `fetch`. In a Node.js server context, you might polyfill
// or use a specific fetch implementation.
// For Next.js, the global fetch is patched and enhanced.

// --- Import para conversión JSON a XML (ejemplo) ---
// En un proyecto real, instalarías una librería como 'xml-js'
// import { json2xml } from 'xml-js';

type HkaEnv = "prod" | "demo";

interface HkaErrorData {
  message: string;
  status?: number;
  body?: any;
  attempts?: number;
}

// --- Configuration ---
const HKA_ENV: HkaEnv = (process.env.NEXT_PUBLIC_HKA_ENV as HkaEnv) || "demo";
const HKA_API_KEY =
  process.env.NEXT_PUBLIC_HKA_API_KEY || "sk_test_XXXXXXXXXXXX";
const HKA_API_BASE_PROD =
  process.env.NEXT_PUBLIC_HKA_API_BASE_PROD ||
  "https://api.hka.production.example";
const HKA_API_BASE_DEMO =
  process.env.NEXT_PUBLIC_HKA_API_BASE_DEMO ||
  "https://api.hka.demo.example";

const BASE_URL =
  HKA_ENV === "prod" ? HKA_API_BASE_PROD : HKA_API_BASE_DEMO;
const MAX_RETRIES = 2;

/**
 * A custom error class for HKA API interactions to carry rich metadata.
 */
export class HkaError extends Error {
  status?: number;
  body?: any;
  attempts?: number;

  constructor({ message, status, body, attempts }: HkaErrorData) {
    super(message);
    this.name = "HkaError";
    this.status = status;
    this.body = body;
    this.attempts = attempts;
  }
}

/**
 * Core request function to communicate with the HKA API.
 */
async function request(
  path: string,
  opts: RequestInit = {},
  retries: number = 0
): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    ...opts,
    headers: {
      // El Content-Type puede variar, por eso se define en las funciones específicas
      Authorization: `Bearer ${HKA_API_KEY}`,
      ...opts.headers,
    },
  };

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status >= 500 && retries < MAX_RETRIES) {
        console.warn(
          `HKA Request failed with status ${response.status}. Retrying... (Attempt ${
            retries + 1
          })`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, retries))
        );
        return request(path, opts, retries + 1);
      }

      const errorBodyText = await response.text();
      let errorBody;
      try {
        errorBody = JSON.parse(errorBodyText);
      } catch {
        errorBody = { message: errorBodyText || "Failed to parse error response." };
      }

      throw new HkaError({
        message:
          errorBody.message || `HTTP Error: ${response.status}`,
        status: response.status,
        body: errorBody,
        attempts: retries + 1,
      });
    }

    if (response.status === 204) {
      return null;
    }

    // La respuesta puede ser XML o JSON, intentamos parsear según el Content-Type
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return await response.json();
    }
    // Si no es JSON, devolvemos el texto (podría ser XML de respuesta)
    return await response.text();

  } catch (error) {
    if (error instanceof HkaError) {
      throw error;
    }

    if (retries < MAX_RETRIES) {
      console.warn(
        `HKA Request failed with network error. Retrying... (Attempt ${
          retries + 1
        })`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, retries))
      );
      return request(path, opts, retries + 1);
    }
    
    throw new HkaError({
        message: (error as Error).message || "A network error occurred.",
        attempts: retries + 1,
    });
  }
}

// --- Funciones de Conversión (Placeholder) ---

/**
 * Convierte un objeto de factura JSON al formato XML requerido por HKA.
 * @param jsonData - El objeto de factura.
 * @returns Una cadena de texto con el XML.
 */
function convertInvoiceToXml(jsonData: object): string {
  // --- LÓGICA DE CONVERSIÓN IRÍA AQUÍ ---
  // En un caso real, usarías una librería como 'xml-js' o 'fast-xml-parser'.
  // Ejemplo: return json2xml(JSON.stringify({ Documento: jsonData }), { compact: true });
  console.log("Simulando conversión de JSON a XML para:", jsonData);
  // Placeholder XML para demostración:
  return `<factura><cliente>${(jsonData as any).customerName}</cliente><id>${(jsonData as any).externalId}</id></factura>`;
}


// --- Exported API Functions ---

export interface HkaResponse {
  success: boolean;
  uuid?: string;
  message?: string;
  data?: any;
}

export interface HkaStatus {
  status: "stamped" | "cancelled" | "processing" | "error" | "not_found";
  uuid?: string;
  folio?: string;
  message: string;
}

/**
 * Stamps an invoice (timbrar) by converting JSON to XML.
 *
 * @param payload - The invoice object (JSON) to be stamped.
 * @returns A promise resolving to an HkaResponse.
 */
export function timbrar(payload: object): Promise<HkaResponse> {
  // 1. Convertir el payload JSON a XML
  const xmlBody = convertInvoiceToXml(payload);

  // 2. Enviar la petición con el cuerpo XML y el Content-Type correcto
  return request("/invoices/timbrar", {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
    },
    body: xmlBody,
  });
}

/**
 * Queries the status of an invoice.
 * (Esta función probablemente no necesita conversión)
 */
export function consultarEstado(uuidOrFolio: string): Promise<HkaStatus> {
  return request(`/invoices/status/${uuidOrFolio}`, { method: "GET" });
}

/**
 * Cancels a previously stamped invoice.
 * (Asumimos que esta operación también podría ser JSON)
 */
export function anular(
  uuidOrFolio: string,
  reason: string
): Promise<HkaResponse> {
  return request(`/invoices/cancel`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: uuidOrFolio, reason }),
  });
}

/**
 * Consults the number of remaining folios.
 */
export async function consultarFolios(): Promise<number> {
  const response = await request("/folios", { method: "GET" });
  if (
    typeof response?.remaining_folios !== "number"
  ) {
    throw new HkaError({ message: "Invalid response format for folios query." });
  }
  return response.remaining_folios;
}
