const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
};

if (process.env.NEXT_OUTPUT_MODE === 'standalone') {
  nextConfig.output = 'standalone';
}

if (process.env.NEXT_ENABLE_OUTPUT_FILE_TRACING_ROOT === '1') {
  nextConfig.experimental = {
    outputFileTracingRoot: path.join(__dirname, '../'),
  };
}

module.exports = nextConfig;
