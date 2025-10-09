
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
}

// --- Session Token Management ---
let sessionToken: { token: string; expires: number } | null = null;

/**
 * Gets the active HKA API configuration from environment variables.
 */
async function getActiveHkaConfig(): Promise<ApiConfig> {
  const env = process.env.NEXT_PUBLIC_HKA_ENV as HkaEnv;

  if (env !== 'demo' && env !== 'prod') {
    throw new HkaError({
      message: "Configuration error: NEXT_PUBLIC_HKA_ENV must be set to 'demo' or 'prod'.",
      status: 500,
    });
  }

  const config: Omit<ApiConfig, 'wsdlUrl'> = {
    env,
    usuario: '',
    clave: '',
  };

  if (env === 'demo') {
    config.usuario = process.env.HKA_USER_DEMO || '';
    config.clave = process.env.HKA_PASS_DEMO || '';
  } else { // prod
    config.usuario = process.env.HKA_USER_PROD || '';
    config.clave = process.env.HKA_PASS_PROD || '';
  }

  const missingVars = Object.entries(config).filter(([, value]) => !value).map(([key]) => key.toUpperCase());
  if (missingVars.length > 0) {
      throw new HkaError({
          message: `Configuration error: Missing environment variables for '${env}' in apphosting.yaml: HKA_${missingVars.join('_DEMO/PROD, HKA_')}_DEMO/PROD.`,
          status: 500,
      });
  }

  return {
    ...config,
    wsdlUrl: env === 'demo'
      ? 'https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc?wsdl'
      : 'https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc?wsdl'
  };
}


/**
 * Creates a SOAP client, authenticates if necessary, and returns the client and token.
 */
async function getAuthenticatedSoapClient() {
  const config = await getActiveHkaConfig();
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
        throw new HkaError({ message: 'Authentication failed: No token received.' });
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
 * The emisorConfig is now fetched from getActiveHkaConfig.
 */
export async function timbrar(payload: object, emisorConfig: { ruc: string; dv: string; name: string }): Promise<any> {
    const { client, token } = await getAuthenticatedSoapClient();
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
        
        // This is a simulation, as the real response structure is not fully detailed.
        return {
            status: result.Estado === "ACEPTADO" ? "stamped" : "processing",
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
 * Consults the number of remaining folios (simulated).
 */
export async function consultarFolios(): Promise<number> {
  // The SOAP API documentation does not specify a method for this.
  // This is a simulated response. In a real scenario, this might not be possible.
  return Math.floor(Math.random() * 1000) + 500;
}
