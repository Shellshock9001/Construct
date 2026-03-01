/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    // Allow Ollama localhost connections
    async rewrites() {
        return [
            {
                source: '/ollama/:path*',
                destination: 'http://localhost:11434/:path*',
            },
        ];
    },
};

module.exports = nextConfig;
