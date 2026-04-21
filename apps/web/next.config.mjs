/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@okr-tool/core'],
  serverExternalPackages: [],
  output: 'standalone',
}

export default nextConfig
