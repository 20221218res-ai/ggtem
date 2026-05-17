import type { MetadataRoute } from "next";

const baseUrl = getBaseUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicRoutes = [
    "",
    "/listings",
    "/support",
    "/sign-in",
    "/sign-up",
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}

function getBaseUrl() {
  const configuredUrl = process.env.GGITEM_BASE_URL || "https://ggtem.com";
  return configuredUrl.replace(/\/+$/, "");
}
