import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const today = new Date();

  return [
    {
      url: "https://sipkesmas.my.id/",
      lastModified: today,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://sipkesmas.my.id/login",
      lastModified: today,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
