# Avocat · Sistema de Medidas y Confección 🧵🥑

Solución web completa con arquitectura desacoplada para confección a medida:
1. **Página Pública para Clientas (`/`)**: Formulario interactivo para toma de medidas y sugerencia de tallas con silueta visual.
2. **Portal Privado para Propietarios / Taller (`/admin`)**: Panel protegido por PIN para consultar pedidos guardados en Redis, descargar **Informes de Confección en PDF** y exportar a Excel.
3. **Backend Serverless en Vercel (`/api/pedidos`)**: Conexión con **Redis (Upstash / Vercel KV)**.

---

## 🌟 Estructura del Sistema

### 1. Web de las Clientas (`/` o `index.html`)
- **Pública y compartible**: Enlace directo para enviar a clientas por WhatsApp, Instagram o enlace bio.
- **Silueta interactiva SVG**: Ilumina zonas corporales (*pecho, cintura, cadera, hombros, manga*).
- **Calculador automático de talla**: Analiza pecho y cadera en tiempo real y sugiere la talla (`XS` a `XXL`).
- **Confirmación instantánea**: Muestra el ID de pedido y permite descargar su ficha individual en PDF.
- **Sin acceso a datos de otras clientas**: No expone listas ni registros de otros clientes.

### 2. Portal Privado del Taller (`/admin` o `admin.html`)
- **Protegido por PIN**: Requiere ingresar el código de seguridad (PIN predeterminado: `1234`, configurable con la variable `ADMIN_PIN`).
- **Métricas de producción**: Total de pedidos recibidos, total de prendas a confeccionar y estado de Redis.
- **Buscador y filtros**: Filtra por nombre de clienta, código de pedido, notas o talla.
- **📄 Informes en Formato PDF**:
  - **Informe Individual de Confección**: Ficha técnica de patronaje con checklist de corte, hilvanado y entrega para el taller.
  - **Informe Maestro de Taller (PDF consolidado)**: Tabla resumen de todos los pedidos + fichas técnicas individuales listas para imprimir.
- **📊 Exportación a Excel (CSV)**: Descarga directa en formato compatible con Excel (UTF-8 con BOM).
- **Gestión**: Opción para eliminar o archivar pedidos completados de Redis.

---

## 📂 Archivos del Proyecto

```text
Avomedidas-1/
├── api/
│   ├── _redis.js        # Adaptador unificado para Redis (Upstash REST, ioredis, memoria)
│   ├── pedidos.js       # Función Serverless Vercel (CRUD protegido con PIN para lectura/borrado)
│   └── health.js        # Diagnóstico de conexión Redis
├── css/
│   ├── styles.css       # Estilos del formulario público de clientas
│   └── admin.css        # Estilos del portal privado del taller
├── js/
│   ├── app.js           # Lógica del formulario público y silueta interactiva
│   └── admin.js         # Lógica del panel privado, PIN, generación de informes PDF y CSV
├── index.html           # Página web pública de clientas (Formulario)
├── admin.html           # Portal privado de taller (Informes y Pedidos)
├── server.js            # Servidor local Node.js
├── vercel.json          # Enrutamiento (/admin -> admin.html) y CORS
├── package.json         # Dependencias (@upstash/redis, ioredis)
└── .env.example         # Variables de entorno
```

---

## 🚀 Pruebas en Local

El servidor local ya se encuentra activo en tu máquina:

- **Formulario de Clientas**: [http://localhost:3000](http://localhost:3000)
- **Portal Privado de Taller**: [http://localhost:3000/admin](http://localhost:3000/admin) *(PIN por defecto: `1234`)*
- **Endpoint API**: [http://localhost:3000/api/pedidos](http://localhost:3000/api/pedidos)

---

## ☁️ Despliegue en Vercel

```powershell
# 1. Desplegar en Vercel
vercel --prod
```

### Variables de Entorno en Vercel:
1. **Base de Datos Redis (Upstash / Vercel KV)**:
   - Ve a la pestaña **Storage** en tu proyecto de Vercel y añade **KV (Upstash)**.
   - Vercel inyectará automáticamente `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
2. **PIN de Acceso al Taller**:
   - En **Settings -> Environment Variables**:
     - Variable: `ADMIN_PIN`
     - Valor: Tu PIN secreto (ejemplo: `9876`).
