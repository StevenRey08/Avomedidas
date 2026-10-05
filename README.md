# Avocat · Tallas y Medidas 🧵🥑

Aplicación web para captura, sugerencia inteligente de tallas y almacenamiento de medidas corporales para pedidos de confección, respaldada por **Funciones Serverless de Vercel** e integración con **Redis (Upstash / Vercel KV)**.

---

## 🌟 Características Principales

1. **Diseño Fiel a la Marca Avocat**:
   - Encabezado con cinta métrica decorativa milimetrada.
   - Silueta corporal femenina interactiva en SVG con resaltado dinámico de zonas de medición (hombros, pecho, cintura, cadera, largo de manga).
   - Tipografía moderna con Google Fonts (*Bricolage Grotesque* y *Figtree*).
   - Paleta de color corporativa verde oliva/aguacate, neutros suaves y acentos verdes.

2. **Cálculo Inteligente de Talla Sugerida**:
   - Analiza en tiempo real los contornos de pecho y cadera para sugerir la talla óptima (`XS`, `S`, `M`, `L`, `XL`, `XXL`).

3. **Backend Serverless en Vercel (`/api/pedidos`)**:
   - `POST /api/pedidos`: Valida campos, calcula la talla recomendada en el servidor, genera un ID único y persiste el pedido en Redis.
   - `GET /api/pedidos`: Lista todos los pedidos almacenados (ordenados del más reciente al más antiguo).
   - `GET /api/pedidos?id=...`: Consulta un pedido específico.
   - `DELETE /api/pedidos?id=...`: Elimina un pedido de Redis.
   - `GET /api/health`: Monitorea el estado y proveedor de la conexión de Redis.

4. **Integración con Redis**:
   - Compatible nativamente con **Vercel KV** y **Upstash Redis** mediante `@upstash/redis` (REST HTTP ideal para entornos Serverless sin límites de sockets).
   - Compatible también con **Redis tradicional (TCP/TLS)** mediante `ioredis` (`REDIS_URL`).
   - Modo de respaldo local (*in-memory fallback*) para desarrollo y pruebas rápidas sin configuración previa.

5. **Generación de Fichas PDF (jsPDF)**:
   - Ficha de confección individual con medidas, notas del cliente y logotipo de Avocat.
   - Descarga consolidada de todos los pedidos con tabla resumen general y fichas individuales.

6. **Panel de Gestión de Pedidos**:
   - Pestaña para administradores/taller para revisar los pedidos recibidos en Redis, buscar por nombre o talla, descargar PDFs o eliminar pedidos procesados.

---

## 📂 Estructura del Proyecto

```text
Avomedidas-1/
├── api/
│   ├── _redis.js        # Adaptador unificado para Redis (Upstash, ioredis, memoria)
│   ├── pedidos.js       # Función Serverless Vercel (CRUD de pedidos)
│   └── health.js        # Endpoint de salud y diagnóstico de Redis
├── css/
│   └── styles.css       # Estilos visuales de Avocat y cinta métrica
├── js/
│   └── app.js           # Lógica frontend, silueta interactiva, API y jsPDF
├── index.html           # Página web principal
├── server.js            # Servidor local Node.js para pruebas directas
├── vercel.json          # Configuración de despliegue y CORS en Vercel
├── package.json         # Dependencias (@upstash/redis, ioredis)
├── .env.example         # Plantilla de variables de entorno para Redis
└── .gitignore
```

---

## 🚀 Puesta en Marcha Local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Iniciar servidor local
Puedes probarlo inmediatamente sin necesidad de instalar o configurar Redis localmente:
```bash
npm start
```
Abre en tu navegador: **[http://localhost:3000](http://localhost:3000)**

---

## ☁️ Conexión con Redis

Para que los datos persistan de forma permanente en la nube:

### Opción A: Vercel KV / Upstash (Recomendado)
1. Entra a tu proyecto en el panel de **[Vercel](https://vercel.com/)**.
2. Ve a la pestaña **Storage** y crea o vincula una base de datos **KV** o **Upstash Redis**.
3. Vercel inyectará automáticamente las variables:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

### Opción B: Redis URL
Configura la variable `REDIS_URL`:
```env
REDIS_URL=rediss://default:tu_password@tu-host.upstash.io:6379
```

---

## 🚢 Despliegue con Vercel CLI

Ya tienes instalado el cliente de Vercel. Para desplegar tu proyecto:

```bash
# 1. Iniciar sesión en Vercel
vercel login

# 2. Desplegar una vista previa
vercel

# 3. Desplegar a producción
vercel --prod
```

---

## 🐙 Despliegue continuo con GitHub CLI (`gh`)

Para subir el código a tu repositorio de GitHub:

```bash
# 1. Añadir cambios y hacer commit
git add .
git commit -m "feat: implementar sitio Avocat con función serverless Vercel y Redis"

# 2. Iniciar sesión en GitHub (si aún no lo has hecho)
gh auth login

# 3. Enviar a tu rama principal
git push -u origin main
```
Una vez vinculado el repositorio en Vercel, cada `git push` desplegará automáticamente la aplicación.
