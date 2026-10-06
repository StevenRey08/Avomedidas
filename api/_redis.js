import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'pedidos.json');

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);


function loadDiskOrders() {
  if (isServerless) return [];
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
    return [];
  }
}

function persistDiskOrders(ordersArray) {
  if (isServerless) return false;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = JSON.stringify(ordersArray, null, 2);
    fs.writeFileSync(DATA_FILE, data, 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
}

// Almacén en memoria para desarrollo local
const memoryStore = new Map();
try {
  const initial = loadDiskOrders();
  initial.forEach((order) => {
    if (order && order.id) {
      memoryStore.set(order.id, order);
    }
  });
} catch { }

let upstashClient = null;
let ioredisClient = null;

/**
 * Detecta y obtiene el cliente de base de datos disponible.
 * Soporta:
 * 1. Vercel KV / Upstash REST (KV_REST_API_URL / UPSTASH_REDIS_REST_URL) -> NUBE 24/7
 * 2. Redis estándar TCP / SSL (REDIS_URL / KV_URL) -> NUBE 24/7
 * 3. Fallback local para desarrollo en PC
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
    return { type: 'upstash', client: upstashClient, isCloud: true };
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
    return { type: 'ioredis', client: ioredisClient, isCloud: true };
  }

  return { type: 'local', client: memoryStore, isCloud: false };
}

const PREFIX = 'avomedidas:pedido:';
const INDEX_KEY = 'avomedidas:pedidos_index';

/**
 * Guarda o actualiza un pedido en la base de datos de la nube.
 */
export async function saveOrder(order) {
  const { type, client, isCloud } = getRedisClient();
  const key = `${PREFIX}${order.id}`;
  const serialized = JSON.stringify(order);
  const score = new Date(order.fecha).getTime() || Date.now();

  if (type === 'upstash') {
    await client.set(key, serialized);
    await client.zadd(INDEX_KEY, { score, member: order.id });
    return { provider: 'upstash-cloud', order };
  }

  if (type === 'ioredis') {
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect();
    }
    await client.set(key, serialized);
    await client.zadd(INDEX_KEY, score, order.id);
    return { provider: 'ioredis-cloud', order };
  }

  // Fallback local cuando no hay nube configurada
  memoryStore.set(order.id, order);
  const all = Array.from(memoryStore.values());
  all.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  persistDiskOrders(all);

  return { provider: 'local-fallback', order };
}

/**
 * Obtiene todos los pedidos desde la base de datos de la nube.
 */
export async function getAllOrders() {
  const { type, client } = getRedisClient();

  if (type === 'upstash') {
    try {
      const ids = await client.zrange(INDEX_KEY, 0, -1, { rev: true });
      if (!ids || ids.length === 0) {
        return [];
      }

      // Procesar en lotes de 200 claves para evitar sobrecargar peticiones REST en grandes volúmenes
      const BATCH_SIZE = 200;
      const allResults = [];
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batchIds = ids.slice(i, i + BATCH_SIZE);
        const keys = batchIds.map((id) => `${PREFIX}${id}`);
        const batchResults = await client.mget(...keys);
        allResults.push(...batchResults);
      }

      return allResults
        .filter(Boolean)
        .map((item) => (typeof item === 'string' ? JSON.parse(item) : item));
    } catch (e) {
      console.error('Error leyendo de Upstash Cloud:', e.message);
      return [];
    }
  }

  if (type === 'ioredis') {
    try {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect();
      }
      const ids = await client.zrevrange(INDEX_KEY, 0, -1);
      if (!ids || ids.length === 0) {
        return [];
      }

      const BATCH_SIZE = 200;
      const allResults = [];
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batchIds = ids.slice(i, i + BATCH_SIZE);
        const keys = batchIds.map((id) => `${PREFIX}${id}`);
        const batchResults = await client.mget(...keys);
        allResults.push(...batchResults);
      }

      return allResults
        .filter(Boolean)
        .map((item) => (typeof item === 'string' ? JSON.parse(item) : item));
    } catch (e) {
      console.error('Error leyendo de ioredis:', e.message);
      return [];
    }
  }

  // Fallback local
  const orders = Array.from(memoryStore.values());
  orders.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  return orders;
}

/**
 * Obtiene un pedido por su ID desde la nube.
 */
export async function getOrderById(id) {
  const { type, client } = getRedisClient();
  const key = `${PREFIX}${id}`;

  if (type === 'upstash') {
    try {
      const data = await client.get(key);
      if (data) return typeof data === 'string' ? JSON.parse(data) : data;
    } catch { }
    return null;
  }

  if (type === 'ioredis') {
    try {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect();
      }
      const data = await client.get(key);
      if (data) return typeof data === 'string' ? JSON.parse(data) : data;
    } catch { }
    return null;
  }

  return memoryStore.get(id) || null;
}

/**
 * Elimina un pedido por su ID en la nube.
 */
export async function deleteOrder(id) {
  const { type, client } = getRedisClient();
  const key = `${PREFIX}${id}`;

  if (type === 'upstash') {
    try {
      await client.del(key);
      await client.zrem(INDEX_KEY, id);
      return true;
    } catch { }
  }

  if (type === 'ioredis') {
    try {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect();
      }
      await client.del(key);
      await client.zrem(INDEX_KEY, id);
      return true;
    } catch { }
  }

  memoryStore.delete(id);
  const remaining = Array.from(memoryStore.values());
  remaining.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  persistDiskOrders(remaining);
  return true;
}

/**
 * Diagnóstico del estado del almacenamiento en la nube.
 */
export async function getRedisStatus() {
  const { type, client } = getRedisClient();
  try {
    if (type === 'upstash') {
      await client.ping();
      return {
        configured: true,
        cloud: true,
        provider: 'Upstash Redis (Nube 24/7)',
        status: 'Conectado a la base de datos en la nube',
      };
    }
    if (type === 'ioredis') {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect();
      }
      await client.ping();
      return {
        configured: true,
        cloud: true,
        provider: 'Redis TCP (Nube 24/7)',
        status: 'Conectado a la base de datos en la nube',
      };
    }

    return {
      configured: false,
      cloud: false,
      provider: isServerless ? 'Sin Base de Datos en la Nube' : 'Modo Local (PC)',
      status: isServerless
        ? 'Alerta: Debes conectar Upstash Redis en Vercel para guardar los pedidos permanentemente 24/7.'
        : 'Desarrollo local en esta computadora. Para producción 24/7, conecta Upstash Redis.',
    };
  } catch (err) {
    return {
      configured: false,
      cloud: false,
      provider: type,
      status: `Error conectando a la base de datos en la nube: ${err.message}`,
    };
  }
}
