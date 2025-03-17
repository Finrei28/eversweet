/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "", // You can leave this empty for standard ports
        pathname: "/dlqjgl6ju/image/upload/**", // Adjust this to match your image paths
      },
    ],
  },
  experimental: {
    reactCompiler: true,
  },
};

export default config;
