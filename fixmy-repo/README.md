# FIX MY

Marketplace local de servicios que conecta clientes con Pro Fixers verificados.

Monorepo con cuatro procesos sobre PostgreSQL/PostGIS y Redis:

- **API** (`apps/api`) — NestJS + Fastify + Prisma + Socket.IO
- **Cliente** (`apps/web-client`) — Next.js 15
- **Administración** (`apps/web-admin`) — Next.js 15
- **Pro Fixer** (`apps/web-pro`) — Next.js 15

Compartidos: `packages/contracts` (tipos), `packages/database` (esquema Prisma, migraciones y seed) y `packages/ui-tokens`.

## Empezar en local

```bash
cp .env.example .env      # rellena JWT_SECRET e INTEGRATION_MASTER_KEY
pnpm install
pnpm dev:infra            # PostgreSQL con PostGIS + Redis vía Docker
pnpm db:setup             # genera Prisma, migra y carga datos demo
pnpm dev                  # arranca los cuatro procesos
```

- Cliente: http://localhost:3000
- Administración: http://localhost:3001
- Pro Fixer: http://localhost:3002
- API: http://localhost:4000 · salud en `/health` · Swagger en `/docs`

Cuentas demo: `admin@fixmy.demo` / `Admin123!`, `client@fixmy.demo` / `Client123!`, `pro@fixmy.demo` / `Pro123!`.

## Desplegar

Consulta **[DEPLOY.md](./DEPLOY.md)**. Cubre tres escenarios: hosting gestionado de BB Cloud (cuatro sitios), un solo servidor con proxy inverso, y Docker Compose.

Un detalle que conviene entender antes: las apps web no llaman a la API desde el navegador, la reenvían por detrás desde `/backend/*`. El destino lo decide la variable **`API_ORIGIN`** en tiempo de ejecución, así que la misma compilación funciona en cualquier entorno sin reconstruir.

## Flujo del marketplace

Un cliente crea una solicitud, que nace en `DRAFT`. Hasta que el pago no se confirma, el trabajo **no se publica ni es visible para ningún Pro**. Una vez pagado pasa a `OPEN`, un Pro lo acepta y recorre `ASSIGNED → PRO_EN_ROUTE → IN_PROGRESS → COMPLETED`, con seguimiento en vivo por websocket.

Esa regla se valida automáticamente:

```bash
pnpm test:flow
```

## Pagos e integraciones

Desde Administración se configuran Stripe (tarjeta y Bancontact), PayPal, Payconiq y un REST genérico. Viene activo por defecto un proveedor de prueba que aprueba o rechaza pagos sin dinero real. Las credenciales se cifran con `INTEGRATION_MASTER_KEY` y nunca se devuelven completas al navegador.

Para Stripe en local, reenvía los eventos a `POST /api/payments/webhooks/stripe`.

## Observabilidad

Administración incluye **Actividad** (eventos de negocio) y **Logs técnicos** (nivel, origen, ruta, código HTTP, request ID, traza y metadatos). Contraseñas, JWT y secretos de pago quedan excluidos a propósito. El `x-request-id` de cualquier respuesta permite localizar el registro exacto.
