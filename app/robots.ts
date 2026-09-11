import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/private/", "/dashboard/"],
    },
    sitemap: "https://sipkesmas.my.id/sitemap.xml",
  };
}