/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://authentication-service:3000/:path*", // internal docker DNS
      },
      {
        source: "/flowise/:path*",
        destination:
          process.env.NEXT_PUBLIC_FLOWISE_PROXY_URL ||
          // When running inside docker, localhost points to the front-end container.
          // Use the service DNS name so the proxy is reachable from the container.
          "http://flowise-proxy:4000/:path*",
      },
    ];
  },
};

export default nextConfig;
