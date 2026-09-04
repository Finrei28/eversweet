// next-sitemap.config.js
export default {
  siteUrl: "https://www.eversweet.co.nz",
  generateRobotsTxt: true,
  exclude: [
    // /about-us renders notFound(), so it is a 404 - listing it in the sitemap
    // just hands Google a dead URL to crawl.
    "/about-us",
    // Transactional steps, not landing pages. They are "use client" so they
    // cannot export metadata (no canonical, no per-page title), and a crawler
    // arriving at either one lands on an empty cart.
    "/checkout",
    "/order",
  ],
};
