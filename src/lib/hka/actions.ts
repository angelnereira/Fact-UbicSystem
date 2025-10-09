
'use server';

import { createClientAsync, ISoapMethod } from 'soap';
import { HkaError, type HkaResponse, type HkaStatus } from './types';
import { convertInvoiceToXml } from './utils';
import { initializeFirebase } from '@/firebase/server';
import { doc, getDoc } from 'firebase/firestore';

type HkaEnv = 'demo' | 'prod';

interface ApiConfig {
  env: HkaEnv;
  wsdlUrl: string;
  usuario: string;
  clave: string;
  emisorRuc: string;
  emisorDv: string;
}

interface ClientConfiguration {
    companyName: string;
    companyRuc: string;
    webhookIdentifier: string;
    demoUser?: string;
    demoPass?: string;
    demoRuc?: string;
    demoDv?: string;
    prodUser?: string;
    prodPass?: string;
    prodRuc?: string;
    prodDv?: string;
}

// --- Session Token Management ---
// A simple in-memory cache for session tokens. Keyed by a unique identifier for the config.
const tokenCache = new Map<string, { token: string; expires: number }>();


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
        usuario: env === 'demo' ? configData.demoUser : configData.prodUser,
        clave: env === 'demo' ? configData.demoPass : configData.prodPass,
        emisorRuc: env === 'demo' ? configData.demoRuc : configData.prodRuc,
        emisorDv: env === 'demo' ? configData.demoDv : configData.prodDv,
    };

    const missingFields = Object.entries(credentials)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        throw new HkaError({
            message: `Configuration '${configData.companyName}' is incomplete for the '${env}' environment. Missing fields: ${missingFields.join(', ')}.`,
            status: 400,
        });
    }

    return {
        ...credentials,
        env,
        wsdlUrl: env === 'demo'
            ? 'https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc?wsdl'
            : 'https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc?wsdl',
    } as ApiConfig;
}


/**
 * Creates a SOAP client, authenticates if necessary, and returns the client and token.
 */
async function getAuthenticatedSoapClient(configId: string, env: HkaEnv) {
  const config = await getHkaConfig(configId, env);
  const client = await createClientAsync(config.wsdlUrl);

  const cacheKey = `${configId}-${env}`;
  let sessionToken = tokenCache.get(cacheKey);

  const now = Date.now();
  if (!sessionToken || sessionToken.expires < now) {
    console.log(`Token for '${cacheKey}' is expired or not found. Authenticating with HKA...`);
    try {
      const authMethod: ISoapMethod = client['AutenticarAsync'];
      const response = await authMethod({
        usuario: config.usuario,
        clave: config.clave,
      });

      const authResult = response[0]?.AutenticarResult;
      if (!authResult?.Token) {
        throw new HkaError({ message: 'Authentication failed: No token received from HKA.' });
      }

      sessionToken = {
        token: authResult.Token,
        // HKA token is valid for 10 mins, let's refresh it after 9 mins.
        expires: now + 9 * 60 * 1000,
      };
      tokenCache.set(cacheKey, sessionToken);
      console.log(`New HKA token obtained for '${cacheKey}'.`);

    } catch (e: any) {
      throw new HkaError({
        message: e.message || 'HKA Authentication failed.',
        status: 500,
        body: e.body,
      });
    }
  }

  return { client, token: sessionToken.token, config };
}

// --- Exported API Functions ---

/**
 * Stamps an invoice (timbrar).
 * @param payload The invoice data.
 * @param configId The ID of the client configuration to use.
 * @param env The environment to use ('demo' or 'prod').
 */
export async function timbrar(payload: object, configId: string, env: HkaEnv): Promise<any> {
    const { client, token, config } = await getAuthenticatedSoapClient(configId, env);
    
    const emisorConfig = {
      ruc: config.emisorRuc,
      dv: config.emisorDv,
      name: "Placeholder Company Name" 
    };

    const xmlBody = convertInvoiceToXml(payload, emisorConfig);
    const documentoBase64 = Buffer.from(xmlBody).toString('base64');
    
    try {
        const method: ISoapMethod = client['EmitirDocumentoAsync'];
        const response = await method({
            token,
            tipoDocumento: 'FE', // Assuming Factura Electrónica
            documentoXML: documentoBase64,
            formatoRespuesta: 'JSON'
        });
        
        const resultStr = response[0]?.EmitirDocumentoResult;
        if (!resultStr) {
          throw new HkaError({ message: 'HKA response was empty or invalid for EmitirDocumento.' });
        }
        
        const parsedResult = JSON.parse(resultStr);

        if (parsedResult.Estado !== 'ACEPTADO') {
            throw new HkaError({
                message: parsedResult.Errores?.join(', ') || 'HKA rejected the document.',
                body: parsedResult
            });
        }
        
        return {
          uuid: parsedResult.CUFE,
          ...parsedResult
        };

    } catch (e: any) {
         if (e instanceof HkaError) throw e;
         throw new HkaError({
            message: e.message || 'SOAP call to EmitirDocumento failed.',
            body: e.body,
            status: 500
        });
    }
}

/**
 * Queries the status of an invoice.
 * @param cufe The unique CUFE identifier of the invoice.
 * @param configId The ID of the client configuration to use.
 * @param env The environment to use ('demo' or 'prod').
 */
export async function consultarEstado(cufe: string, configId: string, env: HkaEnv): Promise<HkaStatus> {
    const { client, token } = await getAuthenticatedSoapClient(configId, env);
     try {
        const method: ISoapMethod = client['ConsultarDocumentoAsync'];
        const response = await method({ token, cufe });
        const resultStr = response[0]?.ConsultarDocumentoResult;
        if (!resultStr) {
          throw new HkaError({ message: 'HKA response was empty or invalid for ConsultarDocumento.' });
        }

        const result = JSON.parse(resultStr);
        
        return {
            status: result.Estado === "ACEPTADO" ? "stamped" : (result.Estado === "ANULADO" ? "cancelled" : "processing"),
            message: `El documento con CUFE ${cufe} se encuentra en estado: ${result.Estado}`,
            uuid: cufe,
            folio: cufe,
            timestamp: new Date().toISOString()
        };

    } catch (e: any) {
         if (e instanceof HkaError) throw e;
         throw new HkaError({
            message: e.message || 'SOAP call to ConsultarDocumento failed.',
            body: e.body,
            status: 500
        });
    }
}

/**
 * Cancels a previously stamped invoice.
 * @param cufe The unique CUFE identifier of the invoice.
 * @param reason The reason for cancellation.
 * @param configId The ID of the client configuration to use.
 * @param env The environment to use ('demo' or 'prod').
 */
export async function anular(cufe: string, reason: string, configId: string, env: HkaEnv): Promise<HkaResponse> {
    const { client, token } = await getAuthenticatedSoapClient(configId, env);
    try {
        const method: ISoapMethod = client['AnularDocumentoAsync'];
        const response = await method({ token, cufe, motivo: reason });
        const resultStr = response[0]?.AnularDocumentoResult;
        if (!resultStr) {
          throw new HkaError({ message: 'HKA response was empty or invalid for AnularDocumento.' });
        }
        
        const result = JSON.parse(resultStr);

         if (result?.Estado !== 'ACEPTADO') {
            throw new HkaError({
                message: result?.Mensaje || 'HKA failed to cancel the document.',
                body: result
            });
        }
        
        return {
          success: true,
          message: result.Mensaje || "Documento anulado con éxito.",
          uuid: cufe
        };
    } catch (e: any) {
         if (e instanceof HkaError) throw e;
         throw new HkaError({
            message: e.message || 'SOAP call to AnularDocumento failed.',
            body: e.body,
            status: 500
        });
    }
}

/**
 * Consults the number of remaining folios.
 * @param configId The ID of the client configuration to use.
 * @param env The environment to use ('demo' or 'prod').
 */
export async function consultarFolios(configId: string, env: HkaEnv): Promise<number> {
    const { client, token } = await getAuthenticatedSoapClient(configId, env);
    try {
        const method: ISoapMethod = client['ConsultarCreditosDisponiblesAsync'];
        const response = await method({ token });
        const result = response[0]?.ConsultarCreditosDisponiblesResult;
        
        if (typeof result?.CreditosDisponibles !== 'number') {
            throw new HkaError({ 
                message: 'Invalid response structure for credit query.', 
                body: result 
            });
        }

        return result.CreditosDisponibles;
    } catch (error: any) {
        if (error instanceof HkaError) {
            console.error("Failed to fetch folios due to HKA client error:", error.message);
            throw error;
        }
        console.error("Failed to fetch folios.", error);
        throw new HkaError({
            message: error.message || 'SOAP call to ConsultarCreditosDisponibles failed.',
            body: error.body,
            status: 500,
        });
    }
}
