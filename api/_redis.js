import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

// Cache client instances across serverless warm invocations
let upstashClient = null;
let ioredisClient = null;
const memoryStore = new Map();

/**
 * Detecta y obtiene el cliente de Redis según las variables de entorno disponibles.
 * Soporta:
 * 1. Vercel KV / Upstash REST (KV_REST_API_URL / UPSTASH_REDIS_REST_URL)
 * 2. Redis estándar TCP / SSL (REDIS_URL / KV_URL)
 * 3. Fallback en memoria para desarrollo local
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

  return { type: 'memory', client: memoryStore };
}

const PREFIX = 'avomedidas:pedido:';
const INDEX_KEY = 'avomedidas:pedidos_index';

/**
 * Guarda un pedido en Redis.
 */
export async function saveOrder(order) {
  const { type, client } = getRedisClient();
  const key = `${PREFIX}${order.id}`;
  const serialized = JSON.stringify(order);
  const score = new Date(order.fecha).getTime() || Date.now();

  if (type === 'upstash') {
    // Guardar el pedido individual y añadir a un sorted set index por timestamp
    await client.set(key, serialized);
    await client.zadd(INDEX_KEY, { score, member: order.id });
    return { provider: 'upstash', order };
  }

  if (type === 'ioredis') {
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect();
    }
    await client.set(key, serialized);
    await client.zadd(INDEX_KEY, score, order.id);
    return { provider: 'ioredis', order };
  }

  // Fallback en memoria
  memoryStore.set(order.id, order);
  return { provider: 'memory', order };
}

/**
 * Obtiene todos los pedidos ordenados de más reciente a más antiguo.
 */
export async function getAllOrders() {
  const { type, client } = getRedisClient();

  if (type === 'upstash') {
    // Obtener IDs ordenados descendentemente (del más reciente al más antiguo)
    const ids = await client.zrange(INDEX_KEY, 0, -1, { rev: true });
    if (!ids || ids.length === 0) return [];

    const keys = ids.map((id) => `${PREFIX}${id}`);
    const results = await client.mget(...keys);

    return results
      .filter(Boolean)
      .map((item) => (typeof item === 'string' ? JSON.parse(item) : item));
  }

  if (type === 'ioredis') {
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect();
    }
    const ids = await client.zrevrange(INDEX_KEY, 0, -1);
    if (!ids || ids.length === 0) return [];

    const keys = ids.map((id) => `${PREFIX}${id}`);
    const results = await client.mget(...keys);

    return results
      .filter(Boolean)
      .map((item) => (typeof item === 'string' ? JSON.parse(item) : item));
  }

  // Fallback en memoria
  const orders = Array.from(memoryStore.values());
  orders.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return orders;
}

/**
 * Obtiene un pedido por su ID.
 */
export async function getOrderById(id) {
  const { type, client } = getRedisClient();
  const key = `${PREFIX}${id}`;

  if (type === 'upstash') {
    const data = await client.get(key);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  if (type === 'ioredis') {
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect();
    }
    const data = await client.get(key);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  return memoryStore.get(id) || null;
}

/**
 * Elimina un pedido por su ID.
 */
export async function deleteOrder(id) {
  const { type, client } = getRedisClient();
  const key = `${PREFIX}${id}`;

  if (type === 'upstash') {
    await client.del(key);
    await client.zrem(INDEX_KEY, id);
    return true;
  }

  if (type === 'ioredis') {
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect();
    }
    await client.del(key);
    await client.zrem(INDEX_KEY, id);
    return true;
  }

  return memoryStore.delete(id);
}

/**
 * Obtiene el estado actual de la conexión de Redis.
 */
export async function getRedisStatus() {
  const { type, client } = getRedisClient();
  try {
    if (type === 'upstash') {
      await client.ping();
      return {
        configured: true,
        provider: 'Upstash Redis / Vercel KV',
        status: 'Conectado y listo',
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
        status: 'Conectado y listo',
      };
    }
    return {
      configured: false,
      provider: 'Almacenamiento en Memoria Temporal',
      status: 'Aviso: Configura KV_REST_API_URL o REDIS_URL en Vercel para persistencia definitiva en Redis',
    };
  } catch (err) {
    return {
      configured: false,
      provider: type,
      status: `Error de conexión: ${err.message}`,
    };
  }
}
