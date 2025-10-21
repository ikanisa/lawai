/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
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
