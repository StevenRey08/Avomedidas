# Avocat · Sistema de Medidas y Confeccion

Solucion web con arquitectura desacoplada para confeccion a medida:
1. **Pagina Publica para Clientas (`/`)**: Formulario interactivo para toma de medidas y sugerencia de tallas con silueta visual.
2. **Portal Privado para Propietarios / Taller (`/admin`)**: Panel protegido por credenciales de acceso para consultar pedidos guardados en Redis, descargar Informes de Confeccion en PDF y exportar a Excel.
3. **Backend Serverless en Vercel (`/api/pedidos`)**: Conexion con Redis (Upstash / Vercel KV).

---

## Estructura del Sistema

### 1. Web de las Clientas (`/` o `index.html`)
- **Publica y compartible**: Enlace directo para enviar a clientas por WhatsApp, Instagram o enlace bio.
- **Silueta interactiva SVG**: Ilumina zonas corporales (pecho, cintura, cadera, hombros, manga).
- **Calculador automatico de talla**: Analiza pecho y cadera en tiempo real y sugiere la talla (XS a XXL).
- **Confirmacion instantanea**: Muestra el ID de pedido y permite descargar su ficha individual en PDF.
- **Sin acceso a datos de otras clientas**: No expone listas ni registros de otros clientes.

### 2. Portal Privado del Taller (`/admin` o `admin.html`)
- **Protegido por Credenciales**:
  - Usuario: `avomarca`
  - Contrasena: `avo1234`
  - (Configurables en Vercel mediante variables `ADMIN_USER` y `ADMIN_PASSWORD`)
- **Metricas de produccion**: Total de pedidos recibidos, total de prendas a confeccionar y estado de Redis.
- **Buscador y filtros**: Filtra por nombre de clienta, codigo de pedido, notas o talla.
- **Informes en Formato PDF**:
  - **Informe Individual de Confeccion**: Ficha tecnica de patronaje con checklist de corte, hilvanado y entrega para el taller.
  - **Informe Maestro de Taller (PDF consolidado)**: Tabla resumen de todos los pedidos + fichas tecnicas individuales listas para imprimir.
- **Exportacion a Excel (CSV)**: Descarga directa en formato compatible con Excel (UTF-8 con BOM).
- **Gestion**: Opcion para eliminar o archivar pedidos completados de Redis.

---

## Archivos del Proyecto

```text
Avomedidas-1/
├── api/
│   ├── _redis.js        # Adaptador unificado para Redis (Upstash REST, ioredis, memoria)
│   ├── pedidos.js       # Funcion Serverless Vercel (CRUD protegido con credenciales)
│   └── health.js        # Diagnostico de conexion Redis
├── css/
│   ├── styles.css       # Estilos del formulario publico de clientas
│   └── admin.css        # Estilos del portal privado del taller
├── js/
│   ├── app.js           # Logica del formulario publico y silueta interactiva
│   └── admin.js         # Logica del panel privado, autenticacion, informes PDF y CSV
├── index.html           # Pagina web publica de clientas (Formulario)
├── admin.html           # Portal privado de taller (Informes y Pedidos)
├── server.js            # Servidor local Node.js
├── vercel.json          # Enrutamiento (/admin -> admin.html) y CORS
├── package.json         # Dependencias (@upstash/redis, ioredis)
└── .env.example         # Variables de entorno
```

---

## Pruebas en Local

El servidor local se encuentra activo en tu maquina:

- **Formulario de Clientas**: http://localhost:3000
- **Portal Privado de Taller**: http://localhost:3000/admin
  - Usuario: `avomarca`
  - Contrasena: `avo1234`
- **Endpoint API**: http://localhost:3000/api/pedidos

---

## Despliegue en Vercel

```powershell
# Desplegar en Vercel
vercel --prod
```

### Variables de Entorno en Vercel (opcional):
1. **Base de Datos Redis (Upstash / Vercel KV)**:
   - En la pestana **Storage** de tu proyecto Vercel, anade **KV (Upstash)**.
   - Vercel inyectara automaticamente `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
2. **Credenciales de Acceso al Taller**:
   - `ADMIN_USER`: `avomarca`
   - `ADMIN_PASSWORD`: `avo1234`
