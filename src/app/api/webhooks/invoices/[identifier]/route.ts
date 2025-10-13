

import { NextResponse } from 'next/server';
import { timbrar } from '@/lib/hka/actions';
import { HkaError } from '@/lib/hka/types';
import { initializeFirebase } from '@/firebase/server';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, limit } from 'firebase/firestore';


/**
 * @swagger
 * /api/webhooks/invoices/{identifier}:
 *   post:
 *     summary: Recibe datos de una factura desde un sistema externo para timbrar.
 *     description: |
 *       Este endpoint de webhook dinámico está diseñado para ser llamado por sistemas externos (como un ERP)
 *       cuando se necesita procesar y timbrar una nueva factura. El `identifier` en la URL es un slug
 *       único configurado por el usuario para identificar su empresa. El payload debe contener la
 *       información de la factura.
 *       La configuración del cliente (credenciales) se carga dinámicamente desde Firestore usando el identifier.
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: Identificador único del webhook configurado para un cliente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               invoice:
 *                 type: object
 *                 description: El objeto de la factura a timbrar.
 *               environment:
 *                  type: string
 *                  description: El ambiente a utilizar ('demo' o 'prod'). Si se omite, se usará 'demo'.
 *     responses:
 *       '200':
 *         description: Factura procesada exitosamente por HKA.
 *       '400':
 *         description: Error de validación o datos faltantes.
 *       '404':
 *         description: No se encontró una configuración para el identificador proporcionado.
 *       '500':
 *         description: Error interno del servidor o fallo en la comunicación con HKA.
 */
export async function POST(request: Request, { params }: { params: { identifier: string } }) {
  const { identifier } = params;
  console.log(`[WEBHOOK] Received request for identifier: ${identifier}`);
  
  const { firestore } = initializeFirebase();
  const invoiceSubmissionsRef = collection(firestore, 'invoiceSubmissions');
  const hkaResponsesRef = collection(firestore, 'hkaResponses');
  
  let submissionDocId: string | null = null;
  let configId: string | null = null;

  try {
    // Find configuration by webhook identifier
    const configQuery = query(
        collection(firestore, "configurations"), 
        where("webhookIdentifier", "==", identifier), 
        limit(1)
    );
    const configSnapshot = await getDocs(configQuery);

    if (configSnapshot.empty) {
        console.error(`[WEBHOOK] No configuration found for identifier '${identifier}'.`);
        return NextResponse.json(
            { message: `No configuration found for webhook identifier '${identifier}'.` },
            { status: 404 }
        );
    }
    configId = configSnapshot.docs[0].id;
    console.log(`[WEBHOOK] Found configuration with ID: ${configId}`);
    
    const body = await request.json();
    const invoicePayload = body.invoice;
    const environment = (body.environment === 'prod') ? 'prod' : 'demo';

    if (!invoicePayload) {
      console.error("[WEBHOOK] Validation Error: Missing 'invoice' payload.");
      return NextResponse.json(
        { message: 'El payload de la factura (invoice) es requerido.' },
        { status: 400 }
      );
    }
    
    const submissionRecord = {
      submissionDate: new Date().toISOString(),
      invoiceData: JSON.stringify(invoicePayload),
      status: 'pending', // Estado inicial
      hkaResponseId: null,
      source: 'webhook',
      configId: configId,
    };
    
    const submissionDocRef = await addDoc(invoiceSubmissionsRef, submissionRecord);
    submissionDocId = submissionDocRef.id;
    console.log(`[WEBHOOK] Created submission record with ID: ${submissionDocId}`);

    const hkaResponse = await timbrar(invoicePayload, configId, environment);
    
    const hkaResponseRecord = {
      responseDate: new Date().toISOString(),
      statusCode: 200, // Assumed success
      responseBody: JSON.stringify(hkaResponse),
      invoiceSubmissionId: submissionDocId,
    };
    const hkaResponseDocRef = await addDoc(hkaResponsesRef, hkaResponseRecord);
    console.log(`[WEBHOOK] Created HKA response record with ID: ${hkaResponseDocRef.id}`);

    const submissionDocToUpdate = doc(firestore, 'invoiceSubmissions', submissionDocId);
    await updateDoc(submissionDocToUpdate, {
      status: 'certified',
      hkaResponseId: hkaResponseDocRef.id
    });
     console.log(`[WEBHOOK] Updated submission ${submissionDocId} to 'certified'.`);

    return NextResponse.json({
        success: true,
        uuid: hkaResponse.uuid || `uuid-${Date.now()}`,
        message: "Factura procesada y timbrada exitosamente."
    }, { status: 200 });

  } catch (error: any) {
    console.error(`[WEBHOOK] Error for identifier [${identifier}]:`, error);

    const errorStatus = error instanceof HkaError ? 'failed' : 'error';
    let hkaResponseId: string | null = null;

    try {
        const hkaResponseRecord = {
            responseDate: new Date().toISOString(),
            statusCode: error.status || 500,
            responseBody: JSON.stringify(error.body || { message: error.message }),
            invoiceSubmissionId: submissionDocId,
        };
        const hkaResponseDocRef = await addDoc(hkaResponsesRef, hkaResponseRecord);
        hkaResponseId = hkaResponseDocRef.id;
        console.log(`[WEBHOOK] Created HKA error response record with ID: ${hkaResponseId}`);
    } catch (dbError) {
        console.error("[WEBHOOK] FATAL: Error saving HKA's error response to Firestore:", dbError);
    }

    if (submissionDocId) {
        try {
            const submissionDocToUpdate = doc(firestore, 'invoiceSubmissions', submissionDocId);
            await updateDoc(submissionDocToUpdate, {
                status: errorStatus,
                hkaResponseId: hkaResponseId,
            });
            console.log(`[WEBHOOK] Updated submission ${submissionDocId} to status '${errorStatus}'.`);
        } catch (updateError) {
            console.error("[WEBHOOK] FATAL: Error updating submission status after an error:", updateError);
        }
    }

    if (error instanceof HkaError) {
      return NextResponse.json(
        { 
          message: 'Error al procesar la factura con HKA.',
          error: {
            details: error.message,
            status: error.status,
            body: error.body
          }
        },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { message: 'Error interno del servidor.', error: error.message },
      { status: 500 }
    );
  }
}
