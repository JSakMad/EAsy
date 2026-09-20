import type { NextConfig } from "next";

const nextConfig: NextConfig = { output: "standalone", transpilePackages: ["@easy-a/core"], experimental: { serverActions: { bodySizeLimit: '3mb' } } };
export default nextConfig;
