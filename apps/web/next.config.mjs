/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@okr-tool/core'],
  serverExternalPackages: [],
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
