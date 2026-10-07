/**
 * STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/Aerosphere-Coba- builds the GitHub
 * Pages bundle; without them it runs as a normal Next.js app.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.STATIC_EXPORT ? "export" : undefined,
  basePath,
  assetPrefix: basePath,
  images: { unoptimized: true },
};

export default nextConfig;
