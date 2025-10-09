
/**
 * @fileoverview
 * This module provides a client for interacting with The Factory HKA API.
 * It reads credentials from environment variables, handles request retries,
 * and provides typed functions for API operations.
 */

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

// --- Configuration Loading from Environment Variables ---

/**
 * Gets the active HKA API configuration from environment variables.
 * @returns {Promise<ApiConfig>} The active API configuration.
 * @throws {HkaError} If the required environment variables are not set.
 */
async function getActiveHkaConfig(): Promise<ApiConfig> {
  const env = process.env.NEXT_PUBLIC_HKA_ENV as HkaEnv;

  if (env !== 'demo' && env !== 'prod') {
    throw new HkaError({
      message: "Configuration error: NEXT_PUBLIC_HKA_ENV must be set to 'demo' or 'prod'.",
      status: 500,
    });
  }

  const config: ApiConfig = {
    env,
    apiKey: '',
    baseUrl: '',
  };

  if (env === 'demo') {
    config.apiKey = process.env.HKA_API_KEY_DEMO || '';
    config.baseUrl = process.env.HKA_API_BASE_DEMO || '';
  } else { // prod
    config.apiKey = process.env.HKA_API_KEY_PROD || '';
    config.baseUrl = process.env.HKA_API_BASE_PROD || '';
  }

  if (!config.apiKey || !config.baseUrl) {
    const missingVars = [];
    if (!config.apiKey) missingVars.push(env === 'demo' ? 'HKA_API_KEY_DEMO' : 'HKA_API_KEY_PROD');
    if (!config.baseUrl) missingVars.push(env === 'demo' ? 'HKA_API_BASE_DEMO' : 'HKA_API_BASE_PROD');
    
    throw new HkaError({
      message: `Configuration error: Missing environment variables for '${env}' environment. Please set: ${missingVars.join(', ')}.`,
      status: 500,
    });
  }
  
  return config;
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
  // Config is now fetched from environment variables inside this function.
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
        console.warn(`HKA Request failed with status ${response.status}. Retrying... (Attempt ${retries + 1})`);
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
 * The 'identifier' parameter is no longer used as config is derived from environment variables.
 */
export function timbrar(payload: object): Promise<HkaResponse> {
  const xmlBody = convertInvoiceToXml(payload);
  return request("/invoices/timbrar", {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
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
  try {
    const response = await request("/folios", { method: "GET" });
    if (typeof response?.remaining_folios === "number") {
      return response.remaining_folios;
    }
    // Return a mock value if the API doesn't provide the expected field.
    return 100;
  } catch (error) {
     if (error instanceof HkaError) {
        // Let the calling UI component handle configuration errors.
        console.error("Failed to fetch folios due to HKA client error:", error.message);
        throw error;
     }
     console.error("Failed to fetch folios.", error);
     throw error;
  }
}
