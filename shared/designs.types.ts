// Cross boundary types. Both the React frontend and Express backend
// Import these so that an API response and the type describing it can't drift apart


//Types only by rule: no runtime code or React imports. Pure types declarations
//  erase at compile time. So importing from here adds nothing to either bundle.

/* A product as the admin Designs page sees it: Shopify data + our curation */

export interface DesignItem {
  id: string; // Shopify GID e.g. "gid://shopify/Product/123"
  title: string;
  imageUrl: string | null;
  imageAlt: string;
  showOnSite: boolean; // Shopify publication state
  featured: boolean; // our curation
  sortOrder: number; // our curation
}