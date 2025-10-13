import { NextResponse } from 'next/server';
import { consultarFolios } from '@/lib/hka/actions';
import { HkaError } from '@/lib/hka/types';

/**
 * @swagger
 * /api/hka/folios:
 *   get:
 *     summary: Consulta los folios restantes para un cliente.
 *     description: Obtiene el número de folios de facturación disponibles para una configuración de cliente y ambiente específicos.
 *     parameters:
 *       - in: query
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *         description: El ID del documento de configuración del cliente.
 *       - in: query
 *         name: env
 *         required: true
 *         schema:
 *           type: string
 *           enum: [demo, prod]
 *         description: El ambiente a consultar ('demo' o 'prod').
 *     responses:
 *       '200':
 *         description: Folios obtenidos exitosamente.
 *       '400':
 *         description: Parámetros faltantes o inválidos.
 *       '500':
 *         description: Error al comunicarse con la API de HKA.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const configId = searchParams.get('configId');
  const env = searchParams.get('env');

  if (!configId || !env) {
    return NextResponse.json({ message: 'Los parámetros configId y env son requeridos.' }, { status: 400 });
  }

  if (env !== 'demo' && env !== 'prod') {
    return NextResponse.json({ message: "El parámetro 'env' debe ser 'demo' o 'prod'." }, { status: 400 });
  }

  try {
    const folios = await consultarFolios(configId, env as 'demo' | 'prod');
    return NextResponse.json({ folios }, { status: 200 });

  } catch (error: any) {
    console.error(`Error al consultar folios para [${configId}]:`, error);

    if (error instanceof HkaError) {
      return NextResponse.json(
        { message: error.body?.message || error.message },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { message: 'Error interno del servidor.', error: error.message },
      { status: 500 }
    );
  }
}
