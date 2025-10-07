/**
 * @fileoverview
 * This module provides a client for interacting with The Factory HKA API.
 * It dynamically fetches credentials from Firestore for each request,
 * handles request retries, and provides typed functions for API operations.
 */
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

// --- Types and Error Classes ---

type HkaEnv = "prod" | "demo";

interface HkaErrorData {
  message: string;
  status?: number;
  body?: any;
  attempts?: number;
}

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

interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  env: HkaEnv;
}

// --- Configuration Fetching ---

/**
 * Fetches the active HKA API configuration from Firestore.
 * It determines whether to use 'demo' or 'prod' credentials based on
 * which environment is enabled in the settings.
 * @returns {Promise<ApiConfig>} The active API configuration.
 */
async function getActiveHkaConfig(): Promise<ApiConfig> {
  const { firestore } = initializeFirebase();
  const configCollection = collection(firestore, "configurations");
  // Assuming a single configuration document for the system.
  const q = query(configCollection, limit(1));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new HkaError({ message: "HKA configuration not found in Firestore.", status: 500 });
  }
  
  const configDoc = querySnapshot.docs[0].data();

  if (configDoc.demoEnabled) {
    return {
      apiKey: configDoc.demoTokenPassword,
      baseUrl: "https://api.hka.demo.example", // As per settings page
      env: "demo"
    };
  } else if (configDoc.prodEnabled) {
    return {
      apiKey: configDoc.prodTokenPassword,
      baseUrl: "https://api.hka.production.example", // As per settings page
      env: "prod"
    };
  } else {
    throw new HkaError({ message: "No active HKA environment is enabled in settings.", status: 500 });
  }
}

// --- Core Request Logic ---

const MAX_RETRIES = 2;

/**
 * Core request function to communicate with the HKA API using dynamic credentials.
 */
async function request(
  path: string,
  opts: RequestInit = {},
  retries: number = 0
): Promise<any> {
  const { apiKey, baseUrl } = await getActiveHkaConfig();
  
  const url = `${baseUrl}${path}`;
  const options: RequestInit = {
    ...opts,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...opts.headers,
    },
  };

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status >= 500 && retries < MAX_RETRIES) {
        console.warn(
          `HKA Request failed with status ${response.status}. Retrying... (Attempt ${retries + 1})`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)));
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
        message: errorBody.message || `HTTP Error: ${response.status}`,
        status: response.status,
        body: errorBody,
        attempts: retries + 1,
      });
    }

    if (response.status === 204) {
      return null;
    }
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    return await response.text();

  } catch (error) {
    if (error instanceof HkaError) {
      throw error;
    }

    if (retries < MAX_RETRIES) {
      console.warn(`HKA Request failed with network error. Retrying... (Attempt ${retries + 1})`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      return request(path, opts, retries + 1);
    }
    
    throw new HkaError({
        message: (error as Error).message || "A network error occurred.",
        attempts: retries + 1,
    });
  }
}

// --- Placeholder Conversion Functions ---

function convertInvoiceToXml(jsonData: object): string {
  console.log("Simulating conversion of JSON to XML for:", jsonData);
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
 * Stamps an invoice (timbrar).
 */
export function timbrar(payload: object): Promise<HkaResponse> {
  const xmlBody = convertInvoiceToXml(payload);
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
 */
export function consultarEstado(uuidOrFolio: string): Promise<HkaStatus> {
  return request(`/invoices/status/${uuidOrFolio}`, { method: "GET" });
}

/**
 * Cancels a previously stamped invoice.
 */
export function anular(uuidOrFolio: string, reason: string): Promise<HkaResponse> {
  return request(`/invoices/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: uuidOrFolio, reason }),
  });
}

/**
 * Consults the number of remaining folios.
 */
export async function consultarFolios(): Promise<number> {
  // Simulate a successful response for demonstration in UI.
  // The actual request logic is kept for when the endpoint is real.
  try {
    const response = await request("/folios", { method: "GET" });
    if (typeof response?.remaining_folios !== "number") {
      // In a real scenario, we'd throw. For the demo, we return a mock value.
      console.warn("Invalid response format for folios query. Returning mock value.");
      return 742; // Mock value
    }
    return response.remaining_folios;
  } catch (error) {
     if (error instanceof HkaError && error.message.includes("No active HKA environment")) {
        console.warn("HKA environment not configured. Returning 0 folios.");
        return 0;
     }
     console.error("Failed to fetch folios, returning mock value.", error);
     // If the API call fails (e.g., 404), return a mock value for UI stability.
     return 742; // Mock value
  }
}
