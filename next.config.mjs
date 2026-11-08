/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdf.js optionally requires these in Node-only code paths
    config.resolve.alias = { ...config.resolve.alias, canvas: false, encoding: false };
    return config;
  },
};
export default nextConfig;
