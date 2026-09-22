import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler requires babel-plugin-react-compiler - enable when added
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
