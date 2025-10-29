/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const assetPrefix = basePath ? `${basePath}/` : undefined;

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["ethers"],
  },
  basePath: basePath || undefined,
  assetPrefix,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
