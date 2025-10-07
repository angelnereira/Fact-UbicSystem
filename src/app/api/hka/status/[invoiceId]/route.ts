import { NextResponse } from 'next/server';
import { consultarEstado, HkaError } from '@/lib/hka/client';

/**
 * @swagger
 * /api/hka/status/{invoiceId}:
 *   get:
 *     summary: Consulta el estado de una factura.
 *     description: Consulta el estado de una factura en el sistema HKA usando su UUID o Folio.
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *         description: El UUID o Folio de la factura a consultar.
 *     responses:
 *       '200':
 *         description: Estado de la factura obtenido exitosamente.
 *       '404':
 *         description: Factura no encontrada.
 *       '500':
 *         description: Error interno o de comunicación con HKA.
 */
export async function GET(request: Request, { params }: { params: { invoiceId: string } }) {
  const { invoiceId } = params;

  if (!invoiceId) {
    return NextResponse.json({ message: 'El ID de la factura es requerido.' }, { status: 400 });
  }

  try {
    // Aquí no pasamos un 'identifier' porque la consulta de estado puede no estar ligada a un webhook.
    // getActiveHkaConfig tomará la primera configuración activa que encuentre.
    const statusResult = await consultarEstado(invoiceId);
    return NextResponse.json(statusResult, { status: 200 });

  } catch (error: any) {
    console.error(`Error al consultar estado para [${invoiceId}]:`, error);

    if (error instanceof HkaError) {
      return NextResponse.json(
        { 
          status: 'error',
          message: error.body?.message || error.message,
          folio: invoiceId,
        },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { 
        status: 'error',
        message: 'Error interno del servidor.',
        folio: invoiceId,
        error: error.message 
      },
      { status: 500 }
    );
  }
}
