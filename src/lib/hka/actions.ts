
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
  rucEmisor: string;
  dv: string;
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
    rucEmisor: '',
    dv: '',
  };

  if (env === 'demo') {
    config.usuario = process.env.HKA_USER_DEMO || '';
    config.clave = process.env.HKA_PASS_DEMO || '';
    config.rucEmisor = process.env.HKA_RUC_DEMO || '';
    config.dv = process.env.HKA_DV_DEMO || '';
  } else { // prod
    config.usuario = process.env.HKA_USER_PROD || '';
    config.clave = process.env.HKA_PASS_PROD || '';
    config.rucEmisor = process.env.HKA_RUC_PROD || '';
    config.dv = process.env.HKA_DV_PROD || '';
  }

  const missingVars = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missingVars.length > 0) {
      throw new HkaError({
          message: `Configuration error: Missing environment variables for '${env}': ${missingVars.join(', ')}.`,
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

  return { client, token: sessionToken.token };
}

// --- Exported API Functions ---

/**
 * Stamps an invoice (timbrar).
 */
export async function timbrar(payload: object, emisorConfig: { ruc: string; dv: string }): Promise<any> {
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
        
        const result = response[0]?.EmitirDocumentoResult;
        const parsedResult = JSON.parse(result);

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
        const result = response[0]?.ConsultarDocumentoResult;
        
        if (!result) {
          throw new Error('No response from ConsultarDocumento');
        }
        
        // This is a simulation, as the real response structure is not fully detailed.
        return {
            status: result.estado === "ACEPTADO" ? "stamped" : "processing",
            message: `El documento con CUFE ${cufe} se encuentra en estado: ${result.estado}`,
            uuid: cufe,
            folio: cufe,
            timestamp: new Date().toISOString()
        };

    } catch (e: any) {
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
        const result = response[0]?.AnularDocumentoResult;

         if (result?.estado !== 'ACEPTADO') {
            throw new HkaError({
                message: result?.mensaje || 'HKA failed to cancel the document.',
                body: result
            });
        }
        
        return {
          success: true,
          message: result.mensaje || "Documento anulado con éxito.",
          uuid: cufe
        };
    } catch (e: any) {
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
  console.log("Simulating folio count. The HKA SOAP API does not provide a standard method for this.");
  return Math.floor(Math.random() * 1000) + 500;
}
