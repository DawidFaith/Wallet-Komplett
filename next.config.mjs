/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['arweave'],
  // Ensure arweave (server-external) is included in Vercel's deployment bundle
  outputFileTracingIncludes: {
    '**': ['./node_modules/arweave/**/*'],
  },
  // fixes wallet connect dependency issue https://docs.walletconnect.com/web3modal/nextjs/about#extra-configuration
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding", "arweave");
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
