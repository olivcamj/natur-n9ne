// Shopify's CDN resizes product photos on request: adding ?width=640 to a cdn.shopify.com URL
// returns a 640px-wide copy (and WebP/AVIF to browsers that accept them). Without it, every
// card downloads the full upload, often 2000px+ and several hundred KB.

const WIDTHS = [320, 480, 640, 828, 1080, 1440, 1920];

const isShopifyCdn = (url: string) => {
  try {
    return new URL(url).hostname === "cdn.shopify.com";
  } catch {
    return false; // relative paths, like the demo products in /public
  }
};

/** The URL resized to `width` pixels wide. Non-Shopify URLs are returned unchanged. */
export function sizedImageUrl(url: string, width: number): string {
  if (!isShopifyCdn(url)) return url;
  const u = new URL(url);
  u.searchParams.set("width", String(width));
  return u.toString();
}

/**
 * `src` and `srcSet` for an <img>, for use with a `sizes` attribute that says how wide the
 * image is drawn. The browser then fetches the smallest copy that stays sharp on the screen.
 * Non-Shopify URLs get only `src`.
 */
export function responsiveImage(url: string, maxWidth = 1920) {
  if (!isShopifyCdn(url)) return { src: url };
  const widths = WIDTHS.filter((w) => w <= maxWidth);
  return {
    src: sizedImageUrl(url, widths.at(-1) ?? maxWidth),
    srcSet: widths.map((w) => `${sizedImageUrl(url, w)} ${w}w`).join(", "),
  };
}
