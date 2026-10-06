import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import pedidosHandler from './api/pedidos.js';
import healthHandler from './api/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

// Protección para que el servidor nunca se caiga por errores imprevistos
process.on('uncaughtException', (err) => {
  console.error('[Avomedidas Servidor] Error no controlado (recuperado):', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Avomedidas Servidor] Rechazo de promesa no controlado:', reason);
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getLocalIp() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch {}
  return null;
}

// Polyfill Vercel-like res helper methods for standalone local node server
function enhanceResponse(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-admin-user, x-admin-pass, x-admin-token, authorization'
  );

  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  enhanceResponse(req, res);

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  req.query = Object.fromEntries(parsedUrl.searchParams);

  // Preflight CORS OPTIONS
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // Read request body for POST/PUT/DELETE
  let bodyData = '';
  req.on('data', (chunk) => {
    bodyData += chunk;
  });

  req.on('end', async () => {
    try {
      if (bodyData) {
        try {
          req.body = JSON.parse(bodyData);
        } catch {
          req.body = bodyData;
        }
      } else {
        req.body = {};
      }

      // Serverless functions routing
      if (pathname === '/api/pedidos' || pathname === '/api/pedidos/') {
        return pedidosHandler(req, res);
      }
      if (pathname === '/api/health' || pathname === '/api/health/') {
        return healthHandler(req, res);
      }

      // Static file serving
      let filePath;
      if (pathname === '/admin' || pathname === '/admin/') {
        filePath = path.join(__dirname, 'admin.html');
      } else if (pathname === '/' || pathname === '') {
        filePath = path.join(__dirname, 'index.html');
      } else {
        filePath = path.join(__dirname, pathname);
      }

      // If file doesn't exist, try index.html
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    } catch (routeErr) {
      console.error('[Error de ruta]', routeErr);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Error interno del servidor');
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n============================================================`);
  console.log(`  AVOMEDIDAS - SERVIDOR ACTIVO Y LISTO PARA LA TIENDA`);
  console.log(`============================================================`);
  console.log(`> En esta computadora:             http://localhost:${PORT}`);
  if (localIp) {
    console.log(`> En tablets/móviles de la tienda: http://${localIp}:${PORT}`);
  }
  console.log(`> Panel privado del taller:        http://localhost:${PORT}/admin`);
  console.log(`> API de pedidos y sincronización: http://localhost:${PORT}/api/pedidos`);
  console.log(`============================================================\n`);
});
