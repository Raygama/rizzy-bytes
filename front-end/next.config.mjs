/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://authentication-service:3000/:path*", // internal docker DNS
      },
    ];
  },
};

export default nextConfig;
