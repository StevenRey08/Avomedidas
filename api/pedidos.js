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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-admin-user, x-admin-pass, x-admin-token, authorization'
  );
}

function verificarCredenciales(req) {
  const userConfig = (process.env.ADMIN_USER || 'avomarca').trim();
  const passConfig = (process.env.ADMIN_PASSWORD || 'avo1234').trim();

  let userRecibido = (req.headers['x-admin-user'] || req.query?.user || req.body?.user || '').trim();
  let passRecibido = (req.headers['x-admin-pass'] || req.query?.pass || req.body?.pass || '').trim();

  // Soporte para token codificado en Base64 (user:pass)
  const token = req.headers['x-admin-token'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (token && (!userRecibido || !passRecibido)) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const partes = decoded.split(':');
      if (partes.length >= 2) {
        userRecibido = partes[0].trim();
        passRecibido = partes.slice(1).join(':').trim();
      }
    } catch {}
  }

  const esValido = userRecibido === userConfig && passRecibido === passConfig;
  return { esValido, userConfig, passConfig };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Obtener pedidos (Protegido para los dueños del taller)
    if (req.method === 'GET') {
      const { esValido } = verificarCredenciales(req);

      if (!esValido) {
        return res.status(401).json({
          success: false,
          error: 'Credenciales de acceso no válidas o no proporcionadas.',
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

    // POST: Iniciar sesión o Guardar nuevo pedido
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

      // Verificación de credenciales de taller
      if (body.action === 'login' || body.action === 'verify_pin') {
        const { esValido, userConfig, passConfig } = verificarCredenciales(req);
        if (esValido) {
          const token = Buffer.from(`${userConfig}:${passConfig}`).toString('base64');
          return res.status(200).json({
            success: true,
            message: 'Autenticación exitosa.',
            token,
            user: userConfig,
          });
        }
        return res.status(401).json({
          success: false,
          error: 'Usuario o contraseña incorrectos.',
        });
      }

      // Guardado de pedido del cliente
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
        message: 'Pedido guardado con éxito.',
        order: nuevoPedido,
        provider: result.provider,
      });
    }

    // DELETE: Eliminar un pedido (Protegido para dueños)
    if (req.method === 'DELETE') {
      const { esValido } = verificarCredenciales(req);
      if (!esValido) {
        return res.status(401).json({
          success: false,
          error: 'Credenciales de acceso no válidas.',
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
        message: `Pedido ${id} eliminado correctamente.`,
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
