import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Elo page became Teams (November 2026). Old links, bookmarks and shared links keep working:
  // a redirect keeps the query (?season=&team=) and the browser keeps the #team fragment.
  async redirects() {
    return [{ source: "/elo", destination: "/teams", permanent: true }];
  },
};

export default nextConfig;
