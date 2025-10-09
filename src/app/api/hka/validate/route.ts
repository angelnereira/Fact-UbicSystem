import { NextResponse } from 'next/server';
import { validateCredentials } from '@/lib/hka/actions';
import { HkaError } from '@/lib/hka/types';

/**
 * @swagger
 * /api/hka/validate:
 *   post:
 *     summary: Valida las credenciales de HKA.
 *     description: Intenta autenticarse contra el API de HKA para verificar si el usuario y la clave son correctos para un ambiente determinado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               environment:
 *                 type: string
 *                 description: El ambiente a validar ('demo' o 'prod').
 *               usuario:
 *                 type: string
 *                 description: El usuario proporcionado por HKA.
 *               clave:
 *                 type: string
 *                 description: La clave proporcionada por HKA.
 *     responses:
 *       '200':
 *         description: Credenciales validadas exitosamente.
 *       '400':
 *         description: Datos faltantes en la solicitud.
 *       '401':
 *         description: Credenciales inválidas.
 *       '500':
 *         description: Error interno o de comunicación con HKA.
 */
export async function POST(request: Request) {
  try {
    const { environment, usuario, clave } = await request.json();

    if (!environment || !usuario || !clave) {
      return NextResponse.json({ message: 'Los campos environment, usuario y clave son requeridos.' }, { status: 400 });
    }
    
    if (environment !== 'demo' && environment !== 'prod') {
        return NextResponse.json({ message: "El 'environment' debe ser 'demo' o 'prod'." }, { status: 400 });
    }

    const result = await validateCredentials(environment, usuario, clave);

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`Error en la validación de credenciales:`, error);

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
