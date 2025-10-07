import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/consult/ruc:
 *   post:
 *     summary: Consulta información de un contribuyente por RUC.
 *     description: Endpoint para verificar la información de un contribuyente a partir de su RUC. (Actualmente simulado)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ruc:
 *                 type: string
 *                 description: El RUC del contribuyente a consultar.
 *     responses:
 *       '200':
 *         description: Información del contribuyente encontrada.
 *       '404':
 *         description: No se encontró contribuyente con el RUC proporcionado.
 *       '500':
 *         description: Error en el servidor.
 */
export async function POST(request: Request) {
  try {
    const { ruc } = await request.json();

    if (!ruc) {
      return NextResponse.json({ message: 'El RUC es requerido.' }, { status: 400 });
    }

    // --- Lógica de Consulta Real (Simulada por ahora) ---
    // En un caso real, aquí llamarías a un servicio externo (API del gobierno, etc.)
    // await new Promise((resolve) => setTimeout(resolve, 1200));

    const isFound = Math.random() > 0.3; // 70% de probabilidad de encontrarlo

    if (isFound) {
      const response = {
        status: 'found',
        name: 'EMPRESA DE EJEMPLO S.A.C.',
        ruc: ruc,
        address: 'AV. SIMULADA 123, LIMA',
        isTaxpayer: true,
        message: 'Contribuyente encontrado y activo.'
      };
      return NextResponse.json(response, { status: 200 });
    } else {
      const response = {
        status: 'not_found',
        message: `No se encontró contribuyente con RUC ${ruc}.`
      };
      return NextResponse.json(response, { status: 404 });
    }
    // --- Fin de la Lógica Simulada ---

  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor.', error: error.message }, { status: 500 });
  }
}
