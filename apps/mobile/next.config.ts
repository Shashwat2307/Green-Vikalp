import { resolve } from "path";
import type { NextConfig } from "next";

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
};

export default nextConfig;
