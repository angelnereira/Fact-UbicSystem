
'use server';

import { createClientAsync, ISoapMethod } from 'soap';
import { HkaError, type HkaResponse, type HkaStatus } from './types';
import { convertInvoiceToXml } from './utils';

type HkaEnv = 'prod' | 'demo';

interface ApiConfig {
  env: HkaEnv;
  wsdlUrl: string;
  usuario: string;
  clave: string;
  emisorRuc: string;
  emisorDv: string;
}

// --- Session Token Management ---
let sessionToken: { token: string; expires: number } | null = null;

/**
 * Gets the active HKA API configuration from environment variables.
 * This is the single source of truth for all credentials.
 */
function getActiveHkaConfig(): ApiConfig {
  const env = process.env.NEXT_PUBLIC_HKA_ENV as HkaEnv;

  if (env !== 'demo' && env !== 'prod') {
    throw new HkaError({
      message: "Configuration error: NEXT_PUBLIC_HKA_ENV must be set to 'demo' or 'prod'.",
      status: 500,
    });
  }

  const config: Omit<ApiConfig, 'wsdlUrl' | 'env'> = {
    usuario: '',
    clave: '',
    emisorRuc: '',
    emisorDv: '',
  };
  
  const varMap: { [key: string]: 'usuario' | 'clave' | 'emisorRuc' | 'emisorDv' } = {
      [env === 'demo' ? 'HKA_USER_DEMO' : 'HKA_USER_PROD']: 'usuario',
      [env === 'demo' ? 'HKA_PASS_DEMO' : 'HKA_PASS_PROD']: 'clave',
      [env === 'demo' ? 'HKA_RUC_DEMO' : 'HKA_RUC_PROD']: 'emisorRuc',
      [env === 'demo' ? 'HKA_DV_DEMO' : 'HKA_DV_PROD']: 'emisorDv',
  };

  const missingVars: string[] = [];
  
  for (const envVar in varMap) {
      const value = process.env[envVar];
      if (value) {
          config[varMap[envVar]] = value;
      } else {
          missingVars.push(envVar);
      }
  }

  if (missingVars.length > 0) {
      throw new HkaError({
          message: `Configuration error in apphosting.yaml: The following secrets are missing for the '${env}' environment: ${missingVars.join(', ')}.`,
          status: 500,
      });
  }

  return {
    ...config,
    env,
    wsdlUrl: env === 'demo'
      ? 'https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc?wsdl'
      : 'https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc?wsdl'
  };
}


/**
 * Creates a SOAP client, authenticates if necessary, and returns the client and token.
 */
async function getAuthenticatedSoapClient() {
  const config = getActiveHkaConfig();
  const client = await createClientAsync(config.wsdlUrl);

  const now = Date.now();
  if (!sessionToken || sessionToken.expires < now) {
    console.log("Token is expired or not found. Authenticating with HKA...");
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
      console.log("New HKA token obtained.");
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
 * The emisorConfig is now fetched internally from environment variables.
 */
export async function timbrar(payload: object): Promise<any> {
    const { client, token, config } = await getAuthenticatedSoapClient();
    
    const emisorConfig = {
      ruc: config.emisorRuc,
      dv: config.emisorDv,
      name: "Placeholder Company Name" // This can be enhanced later if needed
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
 */
export async function consultarEstado(cufe: string): Promise<HkaStatus> {
    const { client, token } = await getAuthenticatedSoapClient();
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
 */
export async function anular(cufe: string, reason: string): Promise<HkaResponse> {
    const { client, token } = await getAuthenticatedSoapClient();
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
 * Consults the number of remaining folios. This is a real call now.
 */
export async function consultarFolios(): Promise<number> {
    const { client, token } = await getAuthenticatedSoapClient();
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
        // Return a value indicating an error to the UI
        return -1;
    }
}
