import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // wollok-ts hace require('console') (módulo de Node). En el browser lo
      // redirigimos al console global mediante un shim.
      config.resolve.alias = {
        ...config.resolve.alias,
        console: fileURLToPath(new URL("./lib/shims/console.cjs", import.meta.url)),
      };
    }
    return config;
  },
};

export default nextConfig;
