/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: "http://authentication-service:3000/auth/:path*",
      },
      {
        source: "/api/kb/:path*",
        destination: "http://flowise-proxy:4000/api/kb/:path*",
      },
      {
        source: "/api/v1/:path*",
        destination: "http://flowise-proxy:4000/api/v1/:path*",
      },
      {
        source: "/api/admin/:path*",
        destination: "http://flowise-proxy:4000/api/admin/:path*",
      },
      {
        source: "/api/chat/:path*",
        destination: "http://flowise-proxy:4000/api/chat/:path*",
      },
      {
        source: "/flowise/:path*",
        destination: "http://flowise-proxy:4000/:path*",
      },
    ];
  },
};

export default nextConfig;
