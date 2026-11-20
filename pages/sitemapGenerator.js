
import { changelogData } from "./public/changelogData.js";
import { writeFileSync } from "node:fs";

const BASE_URL = "https://fluxflow-cli.onrender.com";

const staticRoutes = [
    "/",
    "/getting-started",
    "/startup-args",
    "/app-commands",
    "/models",
    "/api-keys",
    "/architecture",
    "/tools",
    "/parser",
    "/llms",
    "/agents",
    "/changelog"
];

const changelogRoutes = Object.keys(changelogData)
    .map(version => `/changelog/${encodeURIComponent(version)}`);

const urls = [...staticRoutes, ...changelogRoutes];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(route => `  <url>
    <loc>${BASE_URL}${route}</loc>
  </url>`).join("\n")}
</urlset>
`;

writeFileSync("./public/sitemap.xml", sitemap, "utf8");

console.log(`Generated sitemap.xml with ${urls.length} URLs.`);
