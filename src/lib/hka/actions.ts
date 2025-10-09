
'use server';

import { HkaError, type HkaResponse, type HkaStatus } from './types';
import { initializeFirebase } from '@/firebase/server';
import { doc, getDoc } from 'firebase/firestore';

type HkaEnv = 'demo' | 'prod';

interface ApiConfig {
  env: HkaEnv;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

interface ClientConfiguration {
    companyName: string;
    companyRuc: string;
    webhookIdentifier: string;
    demoApiKey?: string;
    demoApiSecret?: string;
    prodApiKey?: string;
    prodApiSecret?: string;
}

/**
 * Gets the active HKA API configuration from a Firestore document.
 * @param configId The ID of the configuration document in Firestore.
 * @param env The environment ('demo' or 'prod') to get credentials for.
 */
async function getHkaConfig(configId: string, env: HkaEnv): Promise<ApiConfig> {
    if (!configId) {
        throw new HkaError({ message: "No configuration ID provided.", status: 400 });
    }

    const { firestore } = initializeFirebase();
    const configRef = doc(firestore, 'configurations', configId);
    const configSnap = await getDoc(configRef);

    if (!configSnap.exists()) {
        throw new HkaError({ message: `Configuration with ID '${configId}' not found.`, status: 404 });
    }

    const configData = configSnap.data() as ClientConfiguration;

    const credentials = {
        apiKey: env === 'demo' ? configData.demoApiKey : configData.prodApiKey,
        apiSecret: env === 'demo' ? configData.demoApiSecret : configData.prodApiSecret,
    };

    if (!credentials.apiKey || !credentials.apiSecret) {
        throw new HkaError({
            message: `Configuration '${configData.companyName}' is incomplete for the '${env}' environment. Missing API Key or Secret.`,
            status: 400,
        });
    }

    return {
        ...credentials,
        env,
        baseUrl: env === 'demo'
            ? 'https://demointegracion.thefactoryhka.com.pa'
            : 'https://integracion.thefactoryhka.com.pa',
    } as ApiConfig;
}

/**
 * A centralized request function for the HKA REST API.
 * @param configId The ID of the client configuration.
 * @param env The environment ('demo' or 'prod').
 * @param endpoint The API endpoint to call (e.g., '/api/v1/document').
 * @param options The options for the fetch request.
 */
async function hkaApiRequest(configId: string, env: HkaEnv, endpoint: string, options: RequestInit): Promise<any> {
    const config = await getHkaConfig(configId, env);

    const url = `${config.baseUrl}${endpoint}`;

    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${config.apiKey}`); // Assuming Bearer token auth
    headers.set('x-api-secret', config.apiSecret); // Or a custom header for the secret

    try {
        const response = await fetch(url, { ...options, headers });
        const responseBody = await response.json();

        if (!response.ok) {
            throw new HkaError({
                message: responseBody.message || 'An error occurred with the HKA API.',
                status: response.status,
                body: responseBody,
            });
        }

        return responseBody;
    } catch (error: any) {
        if (error instanceof HkaError) {
            throw error;
        }
        throw new HkaError({
            message: 'Failed to communicate with HKA API.',
            status: 500,
            body: { details: error.message },
        });
    }
}


// --- Exported API Functions ---

/**
 * Stamps an invoice (timbrar) by sending it to the HKA REST API.
 * @param payload The invoice data object.
 * @param configId The ID of the client configuration to use.
 * @param env The environment to use ('demo' or 'prod').
 */
export async function timbrar(payload: object, configId: string, env: HkaEnv): Promise<any> {
    const endpoint = '/api/v1/document'; // Example endpoint
    const options: RequestInit = {
        method: 'POST',
        body: JSON.stringify(payload),
    };

    const result = await hkaApiRequest(configId, env, endpoint, options);

    // Assuming the response for a successful submission has a CUFE/UUID
    if (!result.cufe && !result.uuid) {
         throw new HkaError({ message: 'HKA response did not contain a CUFE/UUID.', body: result });
    }

    return {
        uuid: result.cufe || result.uuid,
        ...result
    };
}

/**
 * Queries the status of an invoice from the HKA REST API.
 * @param cufe The unique CUFE identifier of the invoice.
 * @param configId The ID of the client configuration to use.
 * @param env The environment to use ('demo' or 'prod').
 */
export async function consultarEstado(cufe: string, configId: string, env: HkaEnv): Promise<HkaStatus> {
    const endpoint = `/api/v1/document/${cufe}/status`; // Example endpoint
    const options: RequestInit = {
        method: 'GET',
    };
    
    const result = await hkaApiRequest(configId, env, endpoint, options);
    
    // Map HKA status to our internal status
    let internalStatus: HkaStatus['status'] = 'processing';
    if (result.estado === 'ACEPTADO') internalStatus = 'stamped';
    if (result.estado === 'ANULADO') internalStatus = 'cancelled';
    if (result.estado === 'RECHAZADO') internalStatus = 'failed';

    return {
        status: internalStatus,
        message: result.mensaje || `Estado del documento: ${result.estado}`,
        uuid: cufe,
        folio: cufe,
        timestamp: result.fecha || new Date().toISOString()
    };
}

/**
 * Cancels a previously stamped invoice via the HKA REST API.
 * @param cufe The unique CUFE identifier of the invoice.
 * @param reason The reason for cancellation.
 * @param configId The ID of the client configuration to use.
 * @param env The environment to use ('demo' or 'prod').
 */
export async function anular(cufe: string, reason: string, configId: string, env: HkaEnv): Promise<HkaResponse> {
    const endpoint = `/api/v1/document/${cufe}/cancel`; // Example endpoint
    const options: RequestInit = {
        method: 'POST',
        body: JSON.stringify({ motivo: reason }),
    };

    const result = await hkaApiRequest(configId, env, endpoint, options);

    return {
        success: result.estado === 'ANULADO',
        message: result.mensaje || "La solicitud de anulación ha sido procesada.",
        uuid: cufe
    };
}

/**
 * Consults the number of remaining folios from the HKA REST API.
 * @param configId The ID of the client configuration to use.
 * @param env The environment to use ('demo' or 'prod').
 */
export async function consultarFolios(configId: string, env: HkaEnv): Promise<number> {
    const endpoint = '/api/v1/credits'; // Example endpoint
    const options: RequestInit = {
        method: 'GET',
    };

    const result = await hkaApiRequest(configId, env, endpoint, options);

    if (typeof result?.creditosDisponibles !== 'number') {
        throw new HkaError({
            message: 'Invalid response structure for credit query.',
            body: result,
        });
    }

    return result.creditosDisponibles;
}
