import { NextResponse } from 'next/server';
import { timbrar } from '@/lib/hka/actions';
import { HkaError } from '@/lib/hka/types';
import { initializeFirebase } from '@/firebase/server';
import { collection, addDoc } from 'firebase/firestore';

/**
 * @swagger
 * /api/hka/timbrar:
 *   post:
 *     summary: Timbra una factura manualmente desde la UI.
 *     description: |
 *       Recibe los datos de una factura desde el formulario de la aplicación,
 *       crea un registro de sumisión en Firestore y la envía a timbrar a HKA.
 *       Este endpoint no requiere un identificador de webhook, ya que usa
 *       la configuración global activa.
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
 *         description: Factura timbrada exitosamente.
 *       '400':
 *         description: Datos de la factura faltantes.
 *       '500':
 *         description: Error interno o fallo en la comunicación con HKA.
 */
export async function POST(request: Request) {
  const { firestore } = initializeFirebase();
  const invoiceSubmissionsRef = collection(firestore, 'invoiceSubmissions');

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
      status: 'pending',
      hkaResponseId: null,
      source: 'manual' // Indica que vino del formulario
    };
    
    const submissionDocRef = await addDoc(invoiceSubmissionsRef, submissionRecord);

    const hkaResponse = await timbrar(invoicePayload);
    
    const hkaResponsesRef = collection(firestore, 'hkaResponses');
    const hkaResponseRecord = {
      responseDate: new Date().toISOString(),
      statusCode: 200,
      responseBody: JSON.stringify(hkaResponse),
      invoiceSubmissionId: submissionDocRef.id,
    };
    const hkaResponseDocRef = await addDoc(hkaResponsesRef, hkaResponseRecord);

    await submissionDocRef.update({
      status: 'certified',
      hkaResponseId: hkaResponseDocRef.id
    });

    return NextResponse.json(hkaResponse, { status: 200 });

  } catch (error: any) {
    console.error('Error en timbrado manual:', error);

    if (error instanceof HkaError) {
      return NextResponse.json(
        { 
          message: error.body?.message || error.message,
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
