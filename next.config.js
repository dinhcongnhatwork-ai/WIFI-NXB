/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack(config, { isServer }) {
    if (isServer) config.externals.push('ssh2');
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '1024mb',
    },
    instrumentationHook: true,
    cpus: 2,
  },
};

module.exports = nextConfig;
