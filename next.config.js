/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow ngrok tunnel in development (fixes 404 when accessing via ngrok URL)
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io', '*.ngrok.app'],
  // When behind ngrok/tunnel, set NEXT_PUBLIC_ASSET_PREFIX to your tunnel URL so asset requests use the same origin
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
