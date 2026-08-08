import type { NextConfig } from "next";

// Origen de la API. Se resuelve en tiempo de ejecucion, no en el build,
// asi que la misma compilacion sirve en cualquier entorno:
//   - Docker Compose        -> http://api:4000
//   - Servidor unico / VPS  -> http://127.0.0.1:4000   (valor por defecto)
//   - Hosting gestionado    -> https://fixmy-api.cloud.bluebridge.es
const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  transpilePackages: ["@fixmy/contracts"],
  distDir: ".next-current",
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
