import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  images: {
    // Las imágenes se sirven desde Supabase Storage; el host se resuelve
    // desde la URL del proyecto para no hardcodear nada.
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [{ protocol: "https", hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname }]
      : [],
  },
};

export default nextConfig;
