// Wholesale links shown to wholesale customers on the customer account
// profile page. They are stored as a JSON shop metafield in the app's reserved
// namespace so the customer account extension can read them.

export const LINKS_NAMESPACE = "$app";
export const LINKS_KEY = "wholesale_links";

export type WholesaleLink = {
  label: string;
  url: string;
};

// Used until the merchant saves their own values from the app home page.
// Keep in sync with DEFAULT_LINKS in
// extensions/additional-link/src/WholesaleBlock.jsx
export const DEFAULT_LINKS: WholesaleLink[] = [
  {
    label: "Wholesale Welcome Packet",
    url: "https://docs.google.com/document/d/1DSAJNmewU7YAW9UrDsxrAQnohHhPmv_UI5EGMLnl7fM/edit?usp=sharing",
  },
  {
    label: "Pricing Information and Download",
    url: "https://netorgft5623825-my.sharepoint.com/:x:/g/personal/callen_valvetronicdesigns_com/IQCV1te-IWpIQrwSrzTEVT6sAagpZgHZFajyqQW1xd8tL_I?rtime=VETf2u1J30g",
  },
  {
    label: "Logo Files",
    url: "https://drive.google.com/drive/folders/16hDWIiaqhUu_gyWUeasgPAfkGcNq_pF5?usp=sharing",
  },
];

export function parseLinks(value: unknown): WholesaleLink[] | null {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;

  return parsed.map((item) => ({
    label: typeof item?.label === "string" ? item.label : "",
    url: typeof item?.url === "string" ? item.url : "",
  }));
}

export function isValidUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
