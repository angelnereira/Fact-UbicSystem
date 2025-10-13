
import { NextResponse } from 'next/server';
import { timbrar } from '@/lib/hka/actions';
import { HkaError } from '@/lib/hka/types';
import { initializeFirebase } from '@/firebase/server';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

/**
 * @swagger
 * /api/hka/timbrar:
 *   post:
 *     summary: Timbra una factura manualmente desde la UI.
 *     description: |
 *       Recibe los datos de una factura desde el formulario, crea un registro de sumisión
 *       y la envía a timbrar a HKA. Las credenciales del emisor se cargan
 *       dinámicamente desde Firestore usando el configId proporcionado.
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
 *               configId:
 *                 type: string
 *                 description: El ID del documento de configuración a utilizar.
 *               environment:
 *                 type: string
 *                 description: El ambiente a utilizar ('demo' o 'prod').
 *     responses:
 *       '200':
 *         description: Factura timbrada exitosamente.
 *       '400':
 *         description: Datos de la factura faltantes o configuración incompleta.
 *       '500':
 *         description: Error interno o fallo en la comunicación con HKA.
 */
export async function POST(request: Request) {
  const { firestore } = initializeFirebase();
  const invoiceSubmissionsRef = collection(firestore, 'invoiceSubmissions');
  let submissionDocId: string | null = null;

  try {
    const body = await request.json();
    const { invoice: invoicePayload, configId, environment } = body;

    console.log(`[API/TIMBRAR] Received request for configId: ${configId}`);

    if (!invoicePayload || !configId || !environment) {
      console.error("[API/TIMBRAR] Validation Error: Missing required fields.");
      return NextResponse.json(
        { message: 'Los campos invoice, configId, y environment son requeridos.' },
        { status: 400 }
      );
    }
    
    const submissionRecord = {
      submissionDate: new Date().toISOString(),
      invoiceData: JSON.stringify(invoicePayload),
      status: 'pending',
      hkaResponseId: null,
      source: 'manual', // Indica que vino del formulario
      configId,
    };
    
    const submissionDocRef = await addDoc(invoiceSubmissionsRef, submissionRecord);
    submissionDocId = submissionDocRef.id;
    console.log(`[API/TIMBRAR] Created submission record with ID: ${submissionDocId}`);

    // Llamar a timbrar con la configuración dinámica.
    const hkaResponse = await timbrar(invoicePayload, configId, environment);
    
    const hkaResponsesRef = collection(firestore, 'hkaResponses');
    const hkaResponseRecord = {
      responseDate: new Date().toISOString(),
      statusCode: 200,
      responseBody: JSON.stringify(hkaResponse),
      invoiceSubmissionId: submissionDocRef.id,
    };
    const hkaResponseDocRef = await addDoc(hkaResponsesRef, hkaResponseRecord);
    console.log(`[API/TIMBRAR] Created HKA response record with ID: ${hkaResponseDocRef.id}`);

    // Actualizar el documento de sumisión
    await updateDoc(submissionDocRef, {
      status: 'certified',
      hkaResponseId: hkaResponseDocRef.id
    });
    console.log(`[API/TIMBRAR] Updated submission ${submissionDocId} to 'certified'.`);

    return NextResponse.json(hkaResponse, { status: 200 });

  } catch (error: any) {
    console.error('[API/TIMBRAR] Error during manual stamping:', error);
    
    // Si hay un error, actualiza el registro de sumisión a 'failed'
    if (submissionDocId) {
        try {
            await updateDoc(doc(firestore, 'invoiceSubmissions', submissionDocId), {
                status: 'failed',
            });
            console.log(`[API/TIMBRAR] Updated submission ${submissionDocId} to 'failed'.`);
        } catch (updateError) {
             console.error(`[API/TIMBRAR] FATAL: Could not update submission ${submissionDocId} to failed status.`, updateError);
        }
    }

    if (error instanceof HkaError) {
      return NextResponse.json(
        { 
          message: error.message,
          details: error.body || 'No additional details.'
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
