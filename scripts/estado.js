import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';

function getLocalIp() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch {}
  return null;
}

const req = http.get('http://localhost:3000/api/health', (res) => {
  console.log('\n============================================================');
  console.log('  ESTADO DEL SERVIDOR: [ENCENDIDO Y OPERATIVO]');
  console.log('============================================================');
  console.log('  > En esta computadora:             http://localhost:3000');
  console.log('  > Panel de administracion:         http://localhost:3000/admin');
  const ip = getLocalIp();
  if (ip) {
    console.log(`  > Tablets/Celulares en la tienda:  http://${ip}:3000`);
  }
  
  const dataPath = path.resolve('data/pedidos.json');
  if (fs.existsSync(dataPath)) {
    try {
      const orders = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      console.log(`\n  > Base de datos en disco:          data/pedidos.json (${orders.length} pedidos)`);
    } catch {
      console.log('\n  > Base de datos en disco:          data/pedidos.json (activa)');
    }
  }

  const startupPath = path.join(
    process.env.APPDATA || '',
    'Microsoft/Windows/Start Menu/Programs/Startup/Avomedidas-AutoInicio.vbs'
  );
  if (fs.existsSync(startupPath)) {
    console.log('  > Auto-inicio con Windows:         [CONFIGURADO] Inicia solo al prender la PC');
  } else {
    console.log('  > Auto-inicio con Windows:         [NO CONFIGURADO] (Usa 1-INSTALAR-AUTO-INICIO-WINDOWS.bat)');
  }
  console.log('============================================================\n');
});

req.on('error', () => {
  console.log('\n============================================================');
  console.log('  ESTADO DEL SERVIDOR: [APAGADO]');
  console.log('============================================================');
  console.log('  El servidor no esta encendido en este momento.');
  console.log('  Para iniciarlo, haz doble clic en INICIAR-SERVIDOR.bat');
  console.log('============================================================\n');
});
