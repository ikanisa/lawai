import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    externalDir: true,
  },
  reactStrictMode: true,
  transpilePackages: ['@avocat-ai/shared'],
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
  },
  webpack: (config) => {
    config.resolve.alias['@avocat-ai/shared'] = path.resolve(
      __dirname,
      '..',
      '..',
      'packages/shared/src',
    );
    return config;
  },
};

export default nextConfig;
