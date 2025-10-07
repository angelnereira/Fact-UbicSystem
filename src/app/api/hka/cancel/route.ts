import { NextResponse } from 'next/server';
import { anular, HkaError } from '@/lib/hka/client';

/**
 * @swagger
 * /api/hka/cancel:
 *   post:
 *     summary: Solicita la anulación de una factura.
 *     description: Envía una solicitud para anular una factura timbrada previamente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               invoiceId:
 *                 type: string
 *                 description: El UUID o Folio de la factura a anular.
 *               reason:
 *                 type: string
 *                 description: El motivo de la anulación.
 *     responses:
 *       '200':
 *         description: Solicitud de anulación enviada exitosamente.
 *       '400':
 *         description: Datos faltantes en la solicitud.
 *       '500':
 *         description: Error interno o de comunicación con HKA.
 */
export async function POST(request: Request) {
  try {
    const { invoiceId, reason } = await request.json();

    if (!invoiceId || !reason) {
      return NextResponse.json({ message: 'El ID de la factura y el motivo son requeridos.' }, { status: 400 });
    }

    // Al igual que en status, no se necesita un 'identifier' específico
    const hkaResponse = await anular(invoiceId, reason);

    return NextResponse.json(hkaResponse, { status: 200 });

  } catch (error: any) {
    console.error(`Error en la anulación:`, error);

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
