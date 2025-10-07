
import { NextResponse } from 'next/server';
import { timbrar, HkaError } from '@/lib/hka/client';
import { addDocumentNonBlocking, updateDocumentNonBlocking, initializeFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

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
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: El identificador único del webhook configurado por el usuario.
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
 *       '404':
 *         description: No se encontró una configuración para el identificador proporcionado.
 *       '500':
 *         description: Error interno del servidor o fallo en la comunicación con HKA.
 */
export async function POST(request: Request, { params }: { params: { identifier: string } }) {
  const { identifier } = params;
  
  // Initialize on the server-side for this route handler
  const { firestore } = initializeFirebase();
  const invoiceSubmissionsRef = collection(firestore, 'invoiceSubmissions');
  const hkaResponsesRef = collection(firestore, 'hkaResponses');
  
  let submissionDocRef;

  try {
    const body = await request.json();
    const invoicePayload = body.invoice;

    if (!invoicePayload) {
      return NextResponse.json(
        { message: 'El payload de la factura (invoice) es requerido.' },
        { status: 400 }
      );
    }
    
    // 1. Crear el registro de sumisión inicial
    const submissionRecord = {
      submissionDate: new Date().toISOString(),
      invoiceData: JSON.stringify(invoicePayload),
      status: 'pending',
      hkaResponseId: null,
    };
    
    submissionDocRef = await addDocumentNonBlocking(invoiceSubmissionsRef, submissionRecord);

    // 2. Intentar timbrar la factura (ahora usa credenciales dinámicas basadas en el identifier)
    const hkaResponse = await timbrar(invoicePayload, identifier);
    
    // 3. Guardar la respuesta de HKA
    const hkaResponseRecord = {
      responseDate: new Date().toISOString(),
      statusCode: 200, // Assumed success
      responseBody: JSON.stringify(hkaResponse),
      invoiceSubmissionId: submissionDocRef.id,
    };
    const hkaResponseDocRef = await addDocumentNonBlocking(hkaResponsesRef, hkaResponseRecord);

    // 4. Actualizar la sumisión original con el estado 'certified' y el ID de la respuesta
    updateDocumentNonBlocking(submissionDocRef, {
      status: 'certified',
      hkaResponseId: hkaResponseDocRef.id
    });

    return NextResponse.json({
        success: true,
        uuid: `uuid-${Date.now()}`,
        message: "Factura procesada y timbrada exitosamente."
    }, { status: 200 });

  } catch (error: any) {
    console.error(`Error en el webhook [${identifier}]:`, error);

    const errorStatus = error instanceof HkaError ? 'failed' : 'error';
    let hkaResponseId = null;

    try {
        const hkaResponseRecord = {
            responseDate: new Date().toISOString(),
            statusCode: error.status || 500,
            responseBody: JSON.stringify(error.body || { message: error.message }),
            invoiceSubmissionId: submissionDocRef ? submissionDocRef.id : null,
        };
        const hkaResponseDocRef = await addDocumentNonBlocking(hkaResponsesRef, hkaResponseRecord);
        hkaResponseId = hkaResponseDocRef.id;
    } catch (dbError) {
        console.error("Error al guardar la respuesta de HKA en Firestore:", dbError);
    }

    if (submissionDocRef) {
        updateDocumentNonBlocking(submissionDocRef, {
            status: errorStatus,
            hkaResponseId: hkaResponseId,
        });
    }

    if (error.message.includes("No configuration found for webhook identifier")) {
        return NextResponse.json({ message: error.message }, { status: 404 });
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
