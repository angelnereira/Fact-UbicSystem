

import { NextResponse } from 'next/server';
import { timbrar } from '@/lib/hka/actions';
import { HkaError } from '@/lib/hka/types';
import { initializeFirebase } from '@/firebase/server';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';


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
 *       NOTA: Con la nueva arquitectura, el `identifier` ya no se usa para buscar credenciales en BD,
 *       pero se mantiene por compatibilidad. La configuración se carga desde variables de entorno.
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: Identificador único del webhook. Ya no es funcional pero se mantiene por compatibilidad.
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
 *     responses:
 *       '200':
 *         description: Factura procesada exitosamente por HKA.
 *       '400':
 *         description: Error de validación o datos faltantes.
 *       '500':
         description: Error interno del servidor o fallo en la comunicación con HKA.
 */
export async function POST(request: Request, { params }: { params: { identifier: string } }) {
  const { identifier } = params;
  
  const { firestore } = initializeFirebase();
  const invoiceSubmissionsRef = collection(firestore, 'invoiceSubmissions');
  const hkaResponsesRef = collection(firestore, 'hkaResponses');
  
  let submissionDocId: string | null = null;

  try {
    const body = await request.json();
    const invoicePayload = body.invoice;

    if (!invoicePayload) {
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
      source: 'webhook'
    };
    
    const submissionDocRef = await addDoc(invoiceSubmissionsRef, submissionRecord);
    submissionDocId = submissionDocRef.id;

    const hkaResponse = await timbrar(invoicePayload);
    
    const hkaResponseRecord = {
      responseDate: new Date().toISOString(),
      statusCode: 200, // Assumed success
      responseBody: JSON.stringify(hkaResponse),
      invoiceSubmissionId: submissionDocId,
    };
    const hkaResponseDocRef = await addDoc(hkaResponsesRef, hkaResponseRecord);

    const submissionDocToUpdate = doc(firestore, 'invoiceSubmissions', submissionDocId);
    await updateDoc(submissionDocToUpdate, {
      status: 'certified',
      hkaResponseId: hkaResponseDocRef.id
    });

    return NextResponse.json({
        success: true,
        uuid: hkaResponse.uuid || `uuid-${Date.now()}`,
        message: "Factura procesada y timbrada exitosamente."
    }, { status: 200 });

  } catch (error: any) {
    console.error(`Error en el webhook [${identifier}]:`, error);

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
    } catch (dbError) {
        console.error("Error al guardar la respuesta de HKA en Firestore:", dbError);
    }

    if (submissionDocId) {
        try {
            const submissionDocToUpdate = doc(firestore, 'invoiceSubmissions', submissionDocId);
            await updateDoc(submissionDocToUpdate, {
                status: errorStatus,
                hkaResponseId: hkaResponseId,
            });
        } catch (updateError) {
            console.error("Error al actualizar el estado de la sumisión:", updateError);
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
