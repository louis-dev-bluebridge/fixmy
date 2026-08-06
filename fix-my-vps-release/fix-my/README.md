# FIX MY

Marketplace local de servicios para conectar clientes con Pro Fixers verificados.

## VPS / producción

Consulta `DEPLOY_AND_TEST.md` para desplegar en Ubuntu con Docker Compose, usar las cuentas demo, probar el flujo completo y revisar los logs técnicos desde Administración.

## Desarrollo local

1. Copia `.env.example` a `.env`.
2. Ejecuta `pnpm install`.
3. Inicia Docker Desktop y después la infraestructura con `pnpm dev:infra`.
4. Inicia las aplicaciones con `pnpm dev`.

La autenticación y los trabajos usan PostgreSQL/PostGIS; Docker Desktop debe estar activo para probar el flujo real.

Servicios:
- Cliente: http://localhost:3000
- Administración: http://localhost:3001
- Pro Fixer: http://localhost:3002
- API: http://localhost:4000
- Documentación API: http://localhost:4000/docs

Cuenta Admin local:
- Email: `admin@fixmy.local`
- Contraseña: `Admin123!`

Flujo de prueba: registra un Pro, apruébalo desde Admin, registra un Cliente, crea una solicitud, selecciona y confirma un pago, y luego acéptala desde la aplicación Pro. Los trabajos no pagados permanecen en borrador y nunca aparecen a los Pros.

## Pagos e integraciones

Administración (`http://localhost:3001`) incluye vistas reales para trabajos, transacciones e integraciones. Desde **Integraciones** se pueden agregar y activar:

- Stripe: tarjeta y Bancontact en Test o Live Mode.
- PayPal y Payconiq: configuración cifrada lista para completar sus adaptadores comerciales.
- REST genérico: base extensible para APIs externas controladas.
- Pago de prueba FIX MY: activo por defecto para aprobar o rechazar pagos sin dinero real.

Las credenciales se cifran con `INTEGRATION_MASTER_KEY` y nunca se devuelven completas al navegador. Para Stripe local, configura desde Admin la clave pública, secret key y webhook secret, y reenvía eventos a:

`http://localhost:4000/api/payments/webhooks/stripe`

## Validación repetible

Con los servicios activos, ejecuta `pnpm test:flow`. La prueba confirma que un trabajo en `DRAFT` no es visible, paga con el proveedor local, comprueba su publicación y recorre aceptación → camino → inicio → completado.
