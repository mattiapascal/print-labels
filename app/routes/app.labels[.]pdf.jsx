import playwright from "playwright";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const ids = url.searchParams.getAll("ids[]");
  if (!ids.length) return new Response("Missing order id(s)", { status: 400 });

  const format = (url.searchParams.get("format") || "100x150").toLowerCase();
  const template = (url.searchParams.get("template") || "minimal").toLowerCase();

  function renderLabel(o, template) {
  const addr1 = [o?.shippingAddress?.address1, o?.shippingAddress?.address2].filter(Boolean).join(" ");
  const cityLine = [o?.shippingAddress?.zip, o?.shippingAddress?.city, o?.shippingAddress?.provinceCode].filter(Boolean).join(" ");
  const country = o?.shippingAddress?.countryCodeV2 || "";

  if (template === "shipping") {
    return `
      <div class="label">
        <div class="title">${o.name}</div>
        <div>${o.shippingAddress?.name ?? ""}</div>
        <div>${addr1}</div>
        <div>${cityLine}</div>
        <div>${country}</div>
        ${o?.shippingAddress?.phone ? `<div style="margin-top:2mm">📞 ${o.shippingAddress.phone}</div>` : ""}

        <div style="margin-top:4mm"><strong>Articoli</strong></div>
        <ul>
          ${(o?.lineItems?.edges ?? []).map(e => `<li>${e.node.quantity} × ${e.node.title}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  // default: minimal
  return `
    <div class="label">
      <div class="title">${o.name}</div>
      <div>${o.shippingAddress?.name ?? ""}</div>
      <div>${addr1}</div>
      <div>${cityLine}</div>
      <div>${country}</div>
    </div>
  `;
}

  // 1) Dati ordine (ridotti all'essenziale per l'etichetta)
  const q = `
    query($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Order {
          id
          name
          shippingAddress { name address1 address2 city zip provinceCode countryCodeV2 phone }
          lineItems(first: 10) { edges { node { title quantity } } }
        }
      }
    }
  `;
  const resp = await admin.graphql(q, { variables: { ids } });
  const data = await resp.json();
  const orders = (data?.data?.nodes || []).filter(Boolean);

  // 2) CSS template per i due formati
const cssByFormat = {
  "100x150": `
    @page { size: 100mm 150mm; margin: 6mm; }
    .sheet { }
    .label { page-break-after: always; border: 1px dashed #999; padding: 6mm; }
  `,
  "a4-2x3": `
    @page { size: A4; margin: 10mm; }
    .sheet {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-auto-rows: 88mm;
      gap: 6mm 10mm;
    }
    .label { border: 1px dashed #999; padding: 6mm; }
    .label:nth-child(6n) { page-break-after: always; }
  `,
  // ⬇️ NUOVO FORMATO: A4 con 3 colonne × 8 righe (24 etichette/pagina)
  "a4-3x8": `
    @page { size: A4; margin: 10mm; }
    body { font-size: 10pt; } /* testo un filo più piccolo per etichette piccole */
    .sheet {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 38mm;         /* altezza “slot” */
      gap: 4mm;                     /* spazio tra etichette */
      align-content: start;
    }
    .label {
      border: 1px dashed #999;
      padding: 3mm;
      box-sizing: border-box;
      overflow: hidden;
    }
    .label:nth-child(24n) { page-break-after: always; } /* nuova pagina ogni 24 */
  `,
};
  const css = cssByFormat[format] || cssByFormat["100x150"];

  // 3) HTML semplice (puoi arricchirlo in seguito)
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; font-size: 12pt; }
          .title { font-size: 14pt; font-weight: 700; margin-bottom: 4mm; }
          ul { margin: 0; padding-left: 18px; }
          ${css}
        </style>
      </head>
      <body>
        <div class="sheet">
          ${orders.map(o => renderLabel(o, template)).join("")}
        </div>
      </body>
    </html>
  `;

  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });

  const pdf = await page.pdf({
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=labels.pdf",
      "Cache-Control": "no-store",
    },
  });
}
