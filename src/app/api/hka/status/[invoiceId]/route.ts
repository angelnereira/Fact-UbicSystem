
import { NextResponse } from 'next/server';
import { consultarEstado } from '@/lib/hka/actions';
import { HkaError } from '@/lib/hka/types';

/**
 * @swagger
 * /api/hka/status/{invoiceId}:
 *   get:
 *     summary: Consulta el estado de una factura.
 *     description: Consulta el estado de una factura en el sistema HKA usando su UUID o Folio. Requiere especificar la configuración del cliente y el ambiente.
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *         description: El UUID o Folio de la factura a consultar.
 *       - in: query
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *         description: El ID del documento de configuración a utilizar.
 *       - in: query
 *         name: env
 *         required: true
 *         schema:
 *           type: string
 *           enum: [demo, prod]
 *         description: El ambiente HKA a consultar ('demo' o 'prod').
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
  const { searchParams } = new URL(request.url);
  const configId = searchParams.get('configId');
  const env = searchParams.get('env');

  if (!invoiceId || !configId || !env) {
    return NextResponse.json({ message: 'Los parámetros invoiceId, configId y env son requeridos.' }, { status: 400 });
  }

  if (env !== 'demo' && env !== 'prod') {
    return NextResponse.json({ message: "El parámetro 'env' debe ser 'demo' o 'prod'." }, { status: 400 });
  }

  try {
    const statusResult = await consultarEstado(invoiceId, configId, env as 'demo' | 'prod');
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
