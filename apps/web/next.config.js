/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  reactStrictMode: true,
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
  },
};

export default nextConfig;
