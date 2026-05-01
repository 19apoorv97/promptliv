/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // In production (Vercel), /api/* is served by Python serverless functions — no rewrite needed.
    // In local dev, proxy to the local FastAPI server.
    if (process.env.NODE_ENV === "production") return [];
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
