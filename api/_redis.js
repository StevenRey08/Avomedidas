import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'pedidos.json');

// Carga inicial y persistencia segura en disco local (permanente)
function loadDiskOrders() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    if (!raw || !raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Aviso: No se pudo leer pedidos.json local:', err.message);
    return [];
  }
}

function persistDiskOrders(ordersArray) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = JSON.stringify(ordersArray, null, 2);
    const tmp = `${DATA_FILE}.tmp`;
    try {
      fs.writeFileSync(tmp, data, 'utf-8');
      if (fs.existsSync(DATA_FILE)) {
        try {
          fs.unlinkSync(DATA_FILE);
        } catch {}
      }
      fs.renameSync(tmp, DATA_FILE);
    } catch {
      fs.writeFileSync(DATA_FILE, data, 'utf-8');
    }
    return true;
  } catch (err) {
    console.error('Error persistiendo pedidos en disco:', err.message);
    return false;
  }
}

// Almacén en memoria sincronizado con disco duro
const memoryStore = new Map();
try {
  const initial = loadDiskOrders();
  initial.forEach((order) => {
    if (order && order.id) {
      memoryStore.set(order.id, order);
    }
  });
} catch {}

// Clientes en caché
let upstashClient = null;
let ioredisClient = null;

/**
 * Detecta y obtiene el cliente de base de datos disponible.
 * Soporta:
 * 1. Vercel KV / Upstash REST (KV_REST_API_URL / UPSTASH_REDIS_REST_URL)
 * 2. Redis estándar TCP / SSL (REDIS_URL / KV_URL)
 * 3. Base de datos local permanente en disco duro (data/pedidos.json)
 */
export function getRedisClient() {
  const upstashUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    if (!upstashClient) {
      upstashClient = new UpstashRedis({
        url: upstashUrl,
        token: upstashToken,
      });
    }
    return { type: 'upstash', client: upstashClient };
  }

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (redisUrl) {
    if (!ioredisClient) {
      ioredisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        lazyConnect: true,
      });
    }
    return { type: 'ioredis', client: ioredisClient };
  }

  return { type: 'local-disk', client: memoryStore };
}

const PREFIX = 'avomedidas:pedido:';
const INDEX_KEY = 'avomedidas:pedidos_index';

/**
 * Guarda o actualiza un pedido en base de datos y disco local.
 */
export async function saveOrder(order) {
  // 1. Guardar siempre en memoria y sincronizar a disco local permanente
  memoryStore.set(order.id, order);
  const allDiskOrders = Array.from(memoryStore.values());
  allDiskOrders.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  persistDiskOrders(allDiskOrders);

  const { type, client } = getRedisClient();
  const key = `${PREFIX}${order.id}`;
  const serialized = JSON.stringify(order);
  const score = new Date(order.fecha).getTime() || Date.now();

  if (type === 'upstash') {
    try {
      await client.set(key, serialized);
      await client.zadd(INDEX_KEY, { score, member: order.id });
      return { provider: 'upstash', order };
    } catch (e) {
      console.warn('Error guardando en Upstash, asegurado en disco local:', e.message);
      return { provider: 'disk-local', order };
    }
  }

  if (type === 'ioredis') {
    try {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect();
      }
      await client.set(key, serialized);
      await client.zadd(INDEX_KEY, score, order.id);
      return { provider: 'ioredis', order };
    } catch (e) {
      console.warn('Error guardando en ioredis, asegurado en disco local:', e.message);
      return { provider: 'disk-local', order };
    }
  }

  return { provider: 'disk-local', order };
}

/**
 * Obtiene todos los pedidos ordenados de más reciente a más antiguo.
 */
export async function getAllOrders() {
  const { type, client } = getRedisClient();

  if (type === 'upstash') {
    try {
      const ids = await client.zrange(INDEX_KEY, 0, -1, { rev: true });
      if (ids && ids.length > 0) {
        const keys = ids.map((id) => `${PREFIX}${id}`);
        const results = await client.mget(...keys);
        const parsed = results
          .filter(Boolean)
          .map((item) => (typeof item === 'string' ? JSON.parse(item) : item));
        if (parsed.length > 0) {
          // Sincronizar memoria y disco local con los datos de Redis
          parsed.forEach((o) => memoryStore.set(o.id, o));
          persistDiskOrders(parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Aviso: Error leyendo de Upstash, recurriendo a disco local:', e.message);
    }
  }

  if (type === 'ioredis') {
    try {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect();
      }
      const ids = await client.zrevrange(INDEX_KEY, 0, -1);
      if (ids && ids.length > 0) {
        const keys = ids.map((id) => `${PREFIX}${id}`);
        const results = await client.mget(...keys);
        const parsed = results
          .filter(Boolean)
          .map((item) => (typeof item === 'string' ? JSON.parse(item) : item));
        if (parsed.length > 0) {
          parsed.forEach((o) => memoryStore.set(o.id, o));
          persistDiskOrders(parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Aviso: Error leyendo de ioredis, recurriendo a disco local:', e.message);
    }
  }

  // Fallback seguro a memoria y disco local
  if (memoryStore.size === 0) {
    const diskList = loadDiskOrders();
    diskList.forEach((o) => memoryStore.set(o.id, o));
  }

  const orders = Array.from(memoryStore.values());
  orders.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  return orders;
}

/**
 * Obtiene un pedido por su ID.
 */
export async function getOrderById(id) {
  const { type, client } = getRedisClient();
  const key = `${PREFIX}${id}`;

  if (type === 'upstash') {
    try {
      const data = await client.get(key);
      if (data) return typeof data === 'string' ? JSON.parse(data) : data;
    } catch {}
  }

  if (type === 'ioredis') {
    try {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect();
      }
      const data = await client.get(key);
      if (data) return typeof data === 'string' ? JSON.parse(data) : data;
    } catch {}
  }

  return memoryStore.get(id) || null;
}

/**
 * Elimina un pedido por su ID.
 */
export async function deleteOrder(id) {
  memoryStore.delete(id);
  const remaining = Array.from(memoryStore.values());
  remaining.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  persistDiskOrders(remaining);

  const { type, client } = getRedisClient();
  const key = `${PREFIX}${id}`;

  if (type === 'upstash') {
    try {
      await client.del(key);
      await client.zrem(INDEX_KEY, id);
    } catch {}
  }

  if (type === 'ioredis') {
    try {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect();
      }
      await client.del(key);
      await client.zrem(INDEX_KEY, id);
    } catch {}
  }

  return true;
}

/**
 * Obtiene el estado actual del almacenamiento.
 */
export async function getRedisStatus() {
  const { type, client } = getRedisClient();
  try {
    if (type === 'upstash') {
      await client.ping();
      return {
        configured: true,
        provider: 'Upstash Redis / Vercel KV',
        status: 'Conectado a la nube y sincronizado en disco local',
      };
    }
    if (type === 'ioredis') {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect();
      }
      await client.ping();
      return {
        configured: true,
        provider: 'Redis (TCP/TLS)',
        status: 'Conectado y sincronizado en disco local',
      };
    }
    return {
      configured: true,
      provider: 'Base de Datos Local (Disco)',
      status: `Permanente y seguro en data/pedidos.json (${memoryStore.size} pedidos)`,
    };
  } catch (err) {
    return {
      configured: false,
      provider: type,
      status: `Disco local activo (Error de conexión externa: ${err.message})`,
    };
  }
}
