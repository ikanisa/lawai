/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverActions: true
  },
  reactStrictMode: true,
  output: 'standalone',
  images: {
    unoptimized: true
  }
};

export default nextConfig;
