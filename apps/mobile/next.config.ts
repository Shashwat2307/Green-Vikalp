import { resolve } from "path";
import type { NextConfig } from "next";

const apiProxy = process.env.API_PROXY_URL || "http://localhost:3001";
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
    ...(isVercel ? {} : { output: "standalone" }),
    typescript: {
        ignoreBuildErrors: true,
    },
    ...(isVercel ? {} : {
        turbopack: {
            root: resolve(__dirname, "../../"),
        },
    }),
    async rewrites() {
        return [
            { source: "/auth/:path*", destination: `${apiProxy}/auth/:path*` },
            { source: "/pipelines/:path*", destination: `${apiProxy}/pipelines/:path*` },
            { source: "/campaigns/:path*", destination: `${apiProxy}/campaigns/:path*` },
            { source: "/leads/:path*", destination: `${apiProxy}/leads/:path*` },
            { source: "/projects/:path*", destination: `${apiProxy}/projects/:path*` },
            { source: "/interactions/:path*", destination: `${apiProxy}/interactions/:path*` },
            { source: "/folders/:path*", destination: `${apiProxy}/folders/:path*` },
            { source: "/documents/:path*", destination: `${apiProxy}/documents/:path*` },
            { source: "/users/:path*", destination: `${apiProxy}/users/:path*` },
            { source: "/tasks/:path*", destination: `${apiProxy}/tasks/:path*` },
            { source: "/meetings/:path*", destination: `${apiProxy}/meetings/:path*` },
            { source: "/health", destination: `${apiProxy}/health` },
        ];
    },
};

export default nextConfig;
