/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
  },
};

export default nextConfig;
