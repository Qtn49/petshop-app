/** @type {import('next').NextConfig} */
const nextConfig = {
  // When behind ngrok/tunnel, set NEXT_PUBLIC_ASSET_PREFIX to your tunnel URL (e.g. https://xxx.ngrok-free.app) so asset requests use the same origin
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || undefined,
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
