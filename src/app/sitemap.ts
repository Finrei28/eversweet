// app/sitemap.ts
import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://eversweet.co.nz",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: "https://eversweet.co.nz/menu",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://eversweet.co.nz/contact",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://eversweet.co.nz/feedback",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },

    // Add all your important pages here
  ];
}
