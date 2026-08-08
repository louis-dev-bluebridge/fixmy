# FIX MY — Guía de despliegue

FIX MY **no es una aplicación, son cuatro procesos** que comparten una base de datos:

| Proceso | Paquete | Puerto por defecto | Qué es |
| --- | --- | --- | --- |
| API | `@fixmy/api` | 4000 | NestJS + Prisma. El cerebro. |
| Cliente | `@fixmy/web-client` | 3000 | App del cliente final. |
| Admin | `@fixmy/web-admin` | 3001 | Control Center. |
| Pro Fixer | `@fixmy/web-pro` | 3002 | App del profesional. |

Más dos servicios de infraestructura: **PostgreSQL con la extensión PostGIS** (obligatoria, el esquema usa `geography(Point,4326)` para geolocalizar clientes y profesionales) y **Redis**.

Las tres apps web no llaman a la API directamente desde el navegador. Cada una expone la ruta `/backend/*` y la reenvía por detrás a la API. El destino se controla con la variable **`API_ORIGIN`**, que se lee en tiempo de ejecución — la misma compilación sirve en cualquier entorno.

---

## Opción 1 — Hosting gestionado de BB Cloud (recomendado)

Se crean **cuatro sitios** en *Websites → Create website*, todos apuntando a este mismo repositorio y rama `main`. Lo único que cambia entre ellos es el comando de build, el de arranque y las variables de entorno.

### 1.1 Base de datos, una sola vez

Usa la base gestionada (`db.cloud.bluebridge.es`) o cualquier PostgreSQL 16+. Habilita PostGIS y prepara el esquema:

```sql
CREATE DATABASE fixmy;
\c fixmy
CREATE EXTENSION IF NOT EXISTS postgis;
```

Después, desde cualquier máquina con el repo clonado y `DATABASE_URL` apuntando a esa base:

```bash
pnpm install
pnpm db:setup     # genera Prisma, aplica migraciones y carga los datos demo
```

### 1.2 Sitio 1 — API

| Campo | Valor |
| --- | --- |
| Nombre | `fixmy-api` |
| Plataforma | Node.js |
| Build | `pnpm install && pnpm build:api` |
| Start | `pnpm start:api` |
| Dominio | `fixmy-api.cloud.bluebridge.es` |

Variables de entorno:

```
DATABASE_URL=postgresql://usuario:password@db.cloud.bluebridge.es:5432/fixmy?schema=public
REDIS_URL=redis://...
JWT_SECRET=<openssl rand -hex 32>
INTEGRATION_MASTER_KEY=<openssl rand -hex 32>
CORS_ORIGINS=https://fixmy.cloud.bluebridge.es,https://fixmy-admin.cloud.bluebridge.es,https://fixmy-pro.cloud.bluebridge.es
PORT=4000
```

Comprobación: `https://fixmy-api.cloud.bluebridge.es/health` debe responder
`{"status":"ok","database":"connected"}`.

### 1.3 Sitios 2, 3 y 4 — las apps web

Idénticos entre sí salvo el nombre del filtro y el dominio:

| Sitio | Build | Start | Dominio |
| --- | --- | --- | --- |
| `fixmy-client` | `pnpm install && pnpm build:client` | `pnpm start:client` | `fixmy.cloud.bluebridge.es` |
| `fixmy-admin` | `pnpm install && pnpm build:admin` | `pnpm start:admin` | `fixmy-admin.cloud.bluebridge.es` |
| `fixmy-pro` | `pnpm install && pnpm build:pro` | `pnpm start:pro` | `fixmy-pro.cloud.bluebridge.es` |

Los tres llevan la misma única variable:

```
API_ORIGIN=https://fixmy-api.cloud.bluebridge.es
```

`PORT` normalmente lo inyecta la plataforma; si no, ponlo a 3000, 3001 y 3002 respectivamente.

> **Importante:** los dominios de los tres sitios web tienen que coincidir exactamente con lo que pusiste en `CORS_ORIGINS` de la API. Si no coinciden, el login falla con un error de CORS en la consola del navegador.

---

## Opción 2 — Un solo servidor (VPS o máquina propia)

Todo en una máquina, sin Docker. Probado sobre Debian 13 y Ubuntu 24.04.

```bash
apt-get update && apt-get install -y curl git ca-certificates \
  postgresql postgresql-postgis redis-server nodejs npm
service postgresql start && service redis-server start
corepack enable

git clone <URL-DEL-REPO> /opt/fixmy && cd /opt/fixmy
cp .env.example .env      # rellena secretos y DATABASE_URL con @localhost
set -a && . ./.env && set +a

pnpm install
pnpm db:setup
pnpm build:api && pnpm build:client && pnpm build:admin && pnpm build:pro

pnpm start:api &
pnpm start:client &
pnpm start:admin &
pnpm start:pro &
```

Con `API_ORIGIN` sin definir se usa `http://127.0.0.1:4000`, que es justo lo que hace falta aquí. La API queda privada y solo se exponen los puertos 3000, 3001 y 3002.

Para publicarlo hacia internet, un proxy inverso delante:

```nginx
server {
    server_name fixmy.tudominio.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Las dos últimas cabeceras no son opcionales: el seguimiento en vivo de los trabajos usa Socket.IO y sin ellas los websockets no conectan.

---

## Opción 3 — Docker Compose

La más simple si la máquina tiene Docker:

```bash
cp .env.example .env      # rellena POSTGRES_PASSWORD, JWT_SECRET, INTEGRATION_MASTER_KEY
docker compose up -d --build
docker compose run --rm migrate pnpm --filter @fixmy/database seed
```

Levanta PostGIS, Redis, la API y las tres apps, con las migraciones aplicadas automáticamente.

---

## Cuentas demo

Las crea `pnpm db:seed`. Son para pruebas: **cámbialas antes de exponer nada al público.**

| Rol | Email | Contraseña |
| --- | --- | --- |
| Admin | `admin@fixmy.demo` | `Admin123!` |
| Cliente | `client@fixmy.demo` | `Client123!` |
| Pro Fixer | `pro@fixmy.demo` | `Pro123!` |

También se siembra `admin@fixmy.local` con la misma contraseña de admin.

El seed es idempotente: puedes ejecutarlo las veces que quieras sin duplicar datos. Crea las categorías multiidioma, un Pro aprobado y en línea, un Cliente, los Admin, una solicitud demo ya pagada y en curso, historial del trabajo, el proveedor de pago de prueba y un registro de actividad.

---

## Verificación

Con la API accesible, el flujo completo del marketplace se prueba solo:

```bash
API_URL=https://fixmy-api.cloud.bluebridge.es/api pnpm test:flow
```

Debe devolver `"ok": true`, con `publicationGate: "PASSED"`, los estados recorriendo
`DRAFT → REQUIRES_ACTION → ASSIGNED → PRO_EN_ROUTE → IN_PROGRESS → COMPLETED`
y `finalPayment: "SUCCEEDED"`.

Eso confirma que la regla de negocio clave se respeta: un trabajo sin pagar queda en borrador y nunca es visible para los profesionales.

---

## Problemas frecuentes

**El build falla y Prisma dice que no encuentra el cliente.** Falta `onlyBuiltDependencies` en `pnpm-workspace.yaml`. pnpm 10 bloquea los postinstall por defecto y sin eso Prisma no se genera. Ya viene en este repositorio; si lo tocas, no lo quites.

**Las apps cargan pero el login da "Failed to fetch" o "Cannot POST /api/api/...".** `API_ORIGIN` está mal. Debe apuntar al origen de la API **sin** `/api` al final: la ruta la añaden las apps.

**Error de CORS en el navegador.** El dominio desde el que entras no está en `CORS_ORIGINS` de la API. Tienen que coincidir con el esquema incluido (`https://`).

**`type "geography" does not exist` al migrar.** Falta PostGIS en la base de datos: `CREATE EXTENSION postgis;`.

**Los procesos mueren al reiniciar el servidor.** En la opción 2 hay que dejarlos bajo systemd o pm2; arrancarlos con `&` no sobrevive a un reinicio.
