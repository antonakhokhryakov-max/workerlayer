import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "lauderdale-mar-seemed-circle.trycloudflare.com",
  ],
  serverExternalPackages: ["exceljs", "unpdf", "pdf-lib", "pptxgenjs", "tsx", "esbuild"],
};

export default nextConfig;
