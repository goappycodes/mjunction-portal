import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tree-shake / lazy-load heavy barrel packages so pages compile and ship
  // smaller client bundles (faster first load).
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tanstack/react-table",
      "@supabase/supabase-js",
      "@supabase/ssr",
    ],
  },
};

export default nextConfig;
