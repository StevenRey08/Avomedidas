import { getRedisStatus } from './_redis.js';

export default async function handler(req, res) {
  const status = await getRedisStatus();
  return res.status(200).json({
    status: 'ok',
    service: 'Avomedidas API',
    timestamp: new Date().toISOString(),
    redis: status,
  });
}
