/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverActions: true
  },
  reactStrictMode: true,
  output: 'standalone'
};

export default nextConfig;
