import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@easy-a/core'],
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  outputFileTracingIncludes: {
    '/offerings/*': [
      '../../node_modules/pdfjs-dist/package.json',
      '../../node_modules/pdfjs-dist/standard_fonts/**/*',
      '../../node_modules/pdfjs-dist/cmaps/**/*',
      './node_modules/pdfjs-dist/package.json',
      './node_modules/pdfjs-dist/standard_fonts/**/*',
      './node_modules/pdfjs-dist/cmaps/**/*',
    ],
  },
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
};
export default nextConfig;
