import type { NextConfig } from "next";

const nextConfig: NextConfig = { output: "standalone", transpilePackages: ["@easy-a/core"] };
export default nextConfig;
