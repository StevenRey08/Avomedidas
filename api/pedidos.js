import {
  saveOrder,
  getAllOrders,
  getOrderById,
  deleteOrder,
  getRedisStatus,
} from './_redis.js';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const BUST_THRESHOLDS = [84, 89, 94, 99, 106, 999];
const HIP_THRESHOLDS = [89, 94, 99, 104, 111, 999];

function getIndex(val, arr) {
  for (let i = 0; i < arr.length; i++) {
    if (val <= arr[i]) return i;
  }
  return arr.length - 1;
}

function calcularTallaSugerida(pecho, cadera) {
  const pIdx = getIndex(pecho, BUST_THRESHOLDS);
  const cIdx = getIndex(cadera, HIP_THRESHOLDS);
  return SIZES[Math.max(pIdx, cIdx)] || 'M';
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-admin-pin, authorization'
  );
}

function verificarPinAdmin(req) {
  const pinConfigurado = process.env.ADMIN_PIN || process.env.ADMIN_PASSWORD || '1234';
  const pinRecibido =
    req.headers['x-admin-pin'] ||
    req.query?.pin ||
    req.body?.pin ||
    (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');

  return {
    valido: String(pinRecibido) === String(pinConfigurado),
    pinConfigurado,
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Obtener pedidos (Protegido por PIN para privacidad de los clientes)
    if (req.method === 'GET') {
      const { valido } = verificarPinAdmin(req);

      if (!valido) {
        return res.status(401).json({
          success: false,
          error: 'PIN de acceso no válido o no proporcionado.',
        });
      }

      const { id } = req.query || {};

      if (id) {
        const order = await getOrderById(id);
        if (!order) {
          return res.status(404).json({
            success: false,
            error: `Pedido con ID ${id} no encontrado.`,
          });
        }
        return res.status(200).json({ success: true, order });
      }

      const orders = await getAllOrders();
      const redisStatus = await getRedisStatus();

      return res.status(200).json({
        success: true,
        count: orders.length,
        orders,
        storage: redisStatus,
      });
    }

    // POST: Crear y guardar un nuevo pedido (Público para los clientes)
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({
            success: false,
            error: 'Formato JSON inválido en el cuerpo de la petición.',
          });
        }
      }

      if (!body) {
        return res.status(400).json({
          success: false,
          error: 'No se recibieron datos en la petición.',
        });
      }

      // Si es una petición de verificación de PIN desde el panel admin
      if (body.action === 'verify_pin') {
        const { valido } = verificarPinAdmin(req);
        return res.status(200).json({
          success: valido,
          message: valido ? 'PIN correcto' : 'PIN incorrecto',
        });
      }

      const nombre = (body.nombre || '').trim();
      const cantidad = parseInt(body.cantidad, 10);
      const talla = (body.talla || '').trim().toUpperCase();
      const pecho = parseFloat(body.pecho);
      const cintura = parseFloat(body.cintura);
      const cadera = parseFloat(body.cadera);
      const hombros = parseFloat(body.hombros);
      const manga = parseFloat(body.manga);

      // Validaciones
      if (!nombre) {
        return res.status(400).json({
          success: false,
          error: 'El nombre completo es obligatorio.',
        });
      }
      if (!cantidad || cantidad < 1 || cantidad > 200) {
        return res.status(400).json({
          success: false,
          error: 'La cantidad debe ser un número entero entre 1 y 200.',
        });
      }
      if (!talla || !SIZES.includes(talla)) {
        return res.status(400).json({
          success: false,
          error: `La talla debe ser una de las siguientes opciones: ${SIZES.join(', ')}.`,
        });
      }

      const medidas = { pecho, cintura, cadera, hombros, manga };
      const faltantes = Object.keys(medidas).filter(
        (m) => isNaN(medidas[m]) || medidas[m] <= 0 || medidas[m] > 300
      );

      if (faltantes.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Las siguientes medidas son inválidas o están incompletas: ${faltantes.join(', ')}. Deben ser valores numéricos válidos en cm.`,
        });
      }

      const tallaSugerida = calcularTallaSugerida(pecho, cadera);
      const uniqueId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

      const nuevoPedido = {
        id: body.id || uniqueId,
        fecha: body.fecha || new Date().toISOString(),
        nombre,
        cantidad,
        talla,
        tallaSugerida,
        pecho,
        cintura,
        cadera,
        hombros,
        manga,
        notas: (body.notas || '').trim(),
      };

      const result = await saveOrder(nuevoPedido);

      return res.status(201).json({
        success: true,
        message: '¡Pedido guardado con éxito!',
        order: nuevoPedido,
        provider: result.provider,
      });
    }

    // DELETE: Eliminar un pedido (Protegido por PIN)
    if (req.method === 'DELETE') {
      const { valido } = verificarPinAdmin(req);
      if (!valido) {
        return res.status(401).json({
          success: false,
          error: 'PIN de acceso no válido o no proporcionado.',
        });
      }

      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere el parámetro "id" para eliminar el pedido.',
        });
      }

      const deleted = await deleteOrder(id);
      return res.status(200).json({
        success: true,
        message: `Pedido ${id} procesado para eliminación.`,
        deleted,
      });
    }

    // Método no permitido
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} no permitido.`,
    });
  } catch (error) {
    console.error('Error procesando petición en /api/pedidos:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno en el servidor.',
      details: error.message,
    });
  }
}
