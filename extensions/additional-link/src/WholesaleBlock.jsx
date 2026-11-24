// @ts-nocheck
import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

export default async () => {
  render(<WholesaleExtension api={shopify} />, document.body);
};

// Used when the merchant has not saved links from the app home page yet, or
// when the saved links cannot be read. Keep in sync with app/wholesale-links.ts
const DEFAULT_LINKS = [
  {
    label: 'Wholesale Welcome Packet',
    url: 'https://docs.google.com/document/d/1DSAJNmewU7YAW9UrDsxrAQnohHhPmv_UI5EGMLnl7fM/edit?usp=sharing',
  },
  {
    label: 'Pricing Information and Download',
    url: 'https://netorgft5623825-my.sharepoint.com/:x:/g/personal/callen_valvetronicdesigns_com/IQCV1te-IWpIQrwSrzTEVT6sAagpZgHZFajyqQW1xd8tL_I?rtime=VETf2u1J30g',
  },
  {
    label: 'Logo Files',
    url: 'https://drive.google.com/drive/folders/16hDWIiaqhUu_gyWUeasgPAfkGcNq_pF5?usp=sharing',
  },
];

const CUSTOMER_ACCOUNT_API = 'shopify://customer-account/api/2026-01/graphql.json';

async function customerAccountQuery(query) {
  const response = await fetch(CUSTOMER_ACCOUNT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return response.json();
}

// Links saved by the merchant on the app home page (shop metafield).
// Any problem here falls back to DEFAULT_LINKS so the banner never breaks.
async function fetchSavedLinks() {
  try {
    const result = await customerAccountQuery(`
      query {
        shop {
          metafield(namespace: "$app", key: "wholesale_links") {
            value
          }
        }
      }
    `);
    const value = result.data?.shop?.metafield?.value;
    if (!value) return null;

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter(
      (link) =>
        typeof link?.label === 'string' &&
        typeof link?.url === 'string' &&
        link.label &&
        link.url.startsWith('https://'),
    );
  } catch (err) {
    console.error('Could not load wholesale links:', err);
    return null;
  }
}

function WholesaleExtension({ api }) {
  const [isWholesale, setIsWholesale] = useState(false);
  const [customerName, setCustomerName] = useState('Customer');
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState(DEFAULT_LINKS);

  useEffect(() => {
    const authCustomerSignal = api.authenticatedAccount?.customer;
    const authCustomer = authCustomerSignal?.value || authCustomerSignal?.v || authCustomerSignal;

    if (authCustomer?.firstName) {
      setCustomerName(authCustomer.firstName);
    }

    const fetchCustomerData = async () => {
      try {
        const [result, savedLinks] = await Promise.all([
          customerAccountQuery(`
            query {
              customer {
                firstName
                metafield(namespace: "custom", key: "is_wholesale") {
                  value
                }
              }
            }
          `),
          fetchSavedLinks(),
        ]);

        if (result.errors) {
          console.error('Customer Account API error:', result.errors);
        } else if (result.data?.customer) {
          if (result.data.customer.firstName) {
            setCustomerName(result.data.customer.firstName);
          }
          const val = result.data.customer.metafield?.value;
          setIsWholesale(val === 'true' || val === true);
        }

        if (savedLinks) setLinks(savedLinks);
      } catch (err) {
        console.error('Could not load customer data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [api]);

  if (loading) return null;

  if (!isWholesale) {
    return null;
  }

  return (
    <s-banner tone="info">
      <s-stack spacing="tight" direction="block">
        <s-text size="large" emphasis="bold">Wholesale Partner Account</s-text>
        <s-text>Welcome back, {customerName}! Here are your exclusive wholesale resources:</s-text>
        <s-stack direction="inline" spacing="loose">
          {links.map((link, index) => (
            <s-link key={link.url} href={link.url} target="_blank">
              <s-button kind={index === 0 ? 'primary' : 'secondary'}>{link.label}</s-button>
            </s-link>
          ))}
        </s-stack>
      </s-stack>
    </s-banner>
  );
}
