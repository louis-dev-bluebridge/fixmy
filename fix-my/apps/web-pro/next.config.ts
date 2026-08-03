import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@fixmy/contracts"],
  distDir: ".next-current",
  async rewrites() {
    return [{ source: "/backend/:path*", destination: "http://api:4000/:path*" }];
  },
};
export default config;
