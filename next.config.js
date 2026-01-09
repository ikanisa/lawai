/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Skip type checking during build if needed (can be overridden)
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === 'true',
  },
  eslint: {
    // Skip ESLint during build if needed
    ignoreDuringBuilds: process.env.SKIP_TYPE_CHECK === 'true',
  },
};

module.exports = nextConfig;
