
import { NextResponse } from 'next/server';
import { timbrar, HkaError } from '@/lib/hka/client';
import { addDocumentNonBlocking, updateDocumentNonBlocking, initializeFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

/**
 * @swagger
 * /api/webhooks/invoices:
 *   post:
 *     summary: Recibe datos de una factura desde un sistema externo para timbrar.
 *     description: |
 *       Este endpoint de webhook está diseñado para ser llamado por sistemas externos (como un ERP)
 *       cuando se necesita procesar y timbrar una nueva factura. El payload debe contener la
 *       información de la factura. La ruta utiliza el módulo HKA para procesar la solicitud y
 *       guarda un registro tanto de la sumisión como de la respuesta en Firestore.
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
 *                 example:
 *                   externalId: "ORD-2024-54321"
 *                   customerName: "Cliente de Ejemplo S.A."
 *                   customerRuc: "CE-12345678"
 *                   items:
 *                     - desc: "Servicio de Consultoría"
 *                       qty: 1
 *                       unitPrice: 500.00
 *     responses:
 *       '200':
 *         description: Factura procesada exitosamente por HKA.
 *       '400':
 *         description: Error de validación o datos faltantes.
 *       '500':
 *         description: Error interno del servidor o fallo en la comunicación con HKA.
 */
export async function POST(request: Request) {
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
    console.log(`Registro de sumisión creado con ID: ${submissionDocRef.id}`);

    // 2. Intentar timbrar la factura (now uses dynamic credentials)
    const hkaResponse = await timbrar(invoicePayload);
    
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

    // Simulate a successful response for demonstration
    const mockSuccessResponse = {
        success: true,
        uuid: `uuid-${Date.now()}`,
        message: "Factura timbrada exitosamente (simulado)."
    };

    return NextResponse.json(mockSuccessResponse, { status: 200 });

  } catch (error: any) {
    console.error('Error en el webhook de facturas:', error);

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
