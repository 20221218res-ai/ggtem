import type { MetadataRoute } from "next";

const baseUrl = getBaseUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/my/",
          "/password-reset/",
          "/verify-email/",
          "/email-recovery",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}

function getBaseUrl() {
  const configuredUrl = process.env.GGITEM_BASE_URL || "https://ggtem.com";
  return configuredUrl.replace(/\/+$/, "");
}
