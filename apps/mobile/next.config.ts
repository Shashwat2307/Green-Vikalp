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
            { source: "/api/:path*", destination: `${apiProxy}/:path*` },
        ];
    },
};

export default nextConfig;
