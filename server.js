import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pedidosHandler from './api/pedidos.js';
import healthHandler from './api/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

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
  });
});

server.listen(PORT, () => {
  console.log(`\nServidor Avomedidas activo en http://localhost:${PORT}`);
  console.log(`API Serverless disponible en http://localhost:${PORT}/api/pedidos`);
  console.log(`Portal de administracion disponible en http://localhost:${PORT}/admin\n`);
});
