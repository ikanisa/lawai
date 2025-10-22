/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    typedRoutes: true,
  },
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
  },
};

export default nextConfig;
