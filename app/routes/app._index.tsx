import { useEffect, useRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  DEFAULT_LINKS,
  LINKS_KEY,
  LINKS_NAMESPACE,
  isValidUrl,
  parseLinks,
  type WholesaleLink,
} from "../wholesale-links";

type ActionResult = {
  ok: boolean;
  links?: WholesaleLink[];
  errors?: string[];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      query wholesaleLinks($namespace: String!, $key: String!) {
        shop {
          metafield(namespace: $namespace, key: $key) {
            value
          }
        }
      }`,
    { variables: { namespace: LINKS_NAMESPACE, key: LINKS_KEY } },
  );
  const { data } = await response.json();
  const saved = parseLinks(data?.shop?.metafield?.value);

  return {
    links: DEFAULT_LINKS.map((fallback, index) => saved?.[index] ?? fallback),
    isSaved: Boolean(saved),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const links: WholesaleLink[] = DEFAULT_LINKS.map((_, index) => ({
    label: String(formData.get(`label_${index}`) ?? "").trim(),
    url: String(formData.get(`url_${index}`) ?? "").trim(),
  }));

  const errors: string[] = [];
  links.forEach((link, index) => {
    // A link with an empty URL is simply hidden from customers.
    if (!link.url) return;
    if (!link.label) errors.push(`Link ${index + 1}: button text is required.`);
    if (!isValidUrl(link.url)) {
      errors.push(`Link ${index + 1}: URL must start with https://`);
    }
  });
  if (errors.length) {
    return { ok: false, errors } satisfies ActionResult;
  }

  // The definition is what makes the metafield readable from the customer
  // account extension. Creating it again once it exists returns a TAKEN
  // error, which is expected.
  const definitionResponse = await admin.graphql(
    `#graphql
      mutation wholesaleLinksDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
          }
          userErrors {
            code
            message
          }
        }
      }`,
    {
      variables: {
        definition: {
          name: "Wholesale links",
          namespace: LINKS_NAMESPACE,
          key: LINKS_KEY,
          type: "json",
          ownerType: "SHOP",
          access: { customerAccount: "READ" },
        },
      },
    },
  );
  const definitionJson = await definitionResponse.json();
  const definitionErrors = (
    definitionJson.data?.metafieldDefinitionCreate?.userErrors ?? []
  ).filter((error: { code?: string }) => error.code !== "TAKEN");
  if (definitionErrors.length) {
    return {
      ok: false,
      errors: definitionErrors.map(
        (error: { message: string }) => error.message,
      ),
    } satisfies ActionResult;
  }

  const shopResponse = await admin.graphql(
    `#graphql
      query shopId {
        shop {
          id
        }
      }`,
  );
  const shopJson = await shopResponse.json();

  const saveResponse = await admin.graphql(
    `#graphql
      mutation saveWholesaleLinks($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
          }
          userErrors {
            message
          }
        }
      }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopJson.data.shop.id,
            namespace: LINKS_NAMESPACE,
            key: LINKS_KEY,
            type: "json",
            value: JSON.stringify(links),
          },
        ],
      },
    },
  );
  const saveJson = await saveResponse.json();
  const saveErrors = saveJson.data?.metafieldsSet?.userErrors ?? [];
  if (saveErrors.length) {
    return {
      ok: false,
      errors: saveErrors.map((error: { message: string }) => error.message),
    } satisfies ActionResult;
  }

  return { ok: true, links } satisfies ActionResult;
};

export default function Index() {
  const { links, isSaved } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const formRef = useRef<HTMLDivElement>(null);

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const errors = fetcher.data?.ok === false ? fetcher.data.errors : undefined;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      shopify.toast.show("Wholesale links saved");
    }
  }, [fetcher.state, fetcher.data, shopify]);

  // Values are read from the fields at save time, so the page does not depend
  // on how the Polaris web components emit their input events.
  const save = () => {
    const formData = new FormData();
    formRef.current
      ?.querySelectorAll<HTMLInputElement>("[data-link-field]")
      .forEach((field) => formData.set(field.name, field.value ?? ""));
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <s-page heading="Wholesale links">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={save}
        {...(isSaving ? { loading: true } : {})}
      >
        Save
      </s-button>

      {errors?.length ? (
        <s-banner tone="critical" heading="The links could not be saved">
          <s-unordered-list>
            {errors.map((error: string) => (
              <s-list-item key={error}>{error}</s-list-item>
            ))}
          </s-unordered-list>
        </s-banner>
      ) : null}

      {!isSaved ? (
        <s-banner tone="info">
          These are the default links. Press Save once to start managing them
          from this page.
        </s-banner>
      ) : null}

      <div ref={formRef}>
        {links.map((link, index) => (
          <s-section key={index} heading={`Link ${index + 1}`}>
            <s-stack direction="block" gap="base">
              <s-text-field
                data-link-field
                label="Button text"
                name={`label_${index}`}
                value={link.label}
                autocomplete="off"
              ></s-text-field>
              <s-url-field
                data-link-field
                label="URL"
                name={`url_${index}`}
                value={link.url}
                details="Must start with https://. Leave empty to hide this button."
                autocomplete="off"
              ></s-url-field>
            </s-stack>
          </s-section>
        ))}
      </div>

      <s-section slot="aside" heading="Where these links appear">
        <s-paragraph>
          Wholesale customers see these buttons in the Wholesale Partner Account
          banner on the Profile page of their customer account.
        </s-paragraph>
        <s-paragraph>
          Changes go live as soon as you save. Customers see the new links the
          next time they open or refresh the page.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Tips">
        <s-unordered-list>
          <s-list-item>
            Paste the full sharing link, including https://.
          </s-list-item>
          <s-list-item>
            Make sure the file is shared so that customers can open it without
            signing in.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
