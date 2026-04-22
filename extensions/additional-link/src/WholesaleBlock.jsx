// @ts-nocheck
import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

export default async () => {
  render(<WholesaleExtension api={shopify} />, document.body);
};

function WholesaleExtension({ api }) {
  const [isWholesale, setIsWholesale] = useState(false);
  const [customerName, setCustomerName] = useState('Customer');
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    // 1. Customer Name aur ID handle karein
    const authCustomerSignal = api.authenticatedAccount?.customer;
    const authCustomer = authCustomerSignal?.value || authCustomerSignal?.v || authCustomerSignal;
    
    if (authCustomer?.firstName) {
      setCustomerName(authCustomer.firstName);
    }

    // 2. Fetch Metafields directly from Customer Account API using shopify:// protocol
    // Ye method explicitly Customer Account API ko hit karta hai (Storefront ko nahi)
    const fetchCustomerData = async () => {
      try {
        const response = await fetch('shopify://customer-account/api/2026-01/graphql.json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              query {
                customer {
                  firstName
                  metafield(namespace: "custom", key: "is_wholesale") {
                    value
                  }
                }
              }
            `,
          }),
        });

        const result = await response.json();
        console.log('Customer Account API Result:', result);

        if (result.errors) {
          setDebugInfo(`GraphQL Error: ${result.errors[0].message}`);
        } else if (result.data?.customer) {
          if (result.data.customer.firstName) {
            setCustomerName(result.data.customer.firstName);
          }
          const val = result.data.customer.metafield?.value;
          const hasMetafield = val === 'true' || val === true;
          setIsWholesale(hasMetafield);
          if (!hasMetafield) setDebugInfo('Metafield returned null or false');
        } else {
          setDebugInfo('No customer data returned');
        }
      } catch (err) {
        setDebugInfo(`Fetch Error: ${err.message}`);
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

  const openLink = (url) => {
    // New tab mein open karne ke liye explicitly window.open use kar rahe hain
    window.open(url, '_blank');
  };

  return (
    <s-banner tone="info">
      <s-stack spacing="tight" direction="block">
        <s-text size="large" emphasis="bold">Wholesale Partner Account</s-text>
        <s-text>Welcome back, {customerName}! Here are your exclusive wholesale resources:</s-text>
        <s-stack direction="inline" spacing="loose">
          <s-link href="https://docs.google.com/document/d/1DSAJNmewU7YAW9UrDsxrAQnohHhPmv_UI5EGMLnl7fM/edit?usp=sharing" target="_blank">
            <s-button kind="primary">Wholesale Welcome Packet</s-button>
          </s-link>
          
          <s-link href="https://docs.google.com/spreadsheets/d/1bM1ZZJ_1a7YMElbZKAAH9i45P2ztYuzX/edit?usp=sharing&ouid=102222610512598755016&rtpof=true&sd=true" target="_blank">
            <s-button kind="secondary">Pricing Information and Download</s-button>
          </s-link>

          <s-link href="https://drive.google.com/drive/folders/16hDWIiaqhUu_gyWUeasgPAfkGcNq_pF5?usp=sharing" target="_blank">
            <s-button kind="secondary">Logo Files</s-button>
          </s-link>
        </s-stack>
      </s-stack>
    </s-banner>
  );
}
