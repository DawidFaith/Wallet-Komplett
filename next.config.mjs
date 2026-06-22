/** @type {import('next').NextConfig} */
const nextConfig = {
  // arweave uses Node.js-native crypto/https — must not be bundled by webpack
  serverExternalPackages: ['arweave'],
  // fixes wallet connect dependency issue https://docs.walletconnect.com/web3modal/nextjs/about#extra-configuration
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
