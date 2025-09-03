// app/routes/app.print-labels.jsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server"; // tieni questo relativo, come hai già fatto
import { useState } from "react";
import { prisma } from "../db.server";

function parseList(q) {
  if (!q) return [];
  try {
    const j = JSON.parse(q);
    if (Array.isArray(j)) return j;
  } catch {}
  return String(q).split(",").map(s => s.trim()).filter(Boolean);
}

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const host = url.searchParams.get("host") || null;
  const shop = session.shop;

  // recupera settings da Prisma
  const settings = await prisma.shopSetting.findUnique({ where: { shop } });
  const defaultFormat = settings?.defaultFormat || "100x150";
  const defaultTemplate = settings?.defaultTemplate || "minimal";
  
  // Raccogli tutte le forme possibili dagli Admin Link / bulk
  const idParams = [
      ...url.searchParams.getAll("ids[]"),
      ...url.searchParams.getAll("ids"),
      url.searchParams.get("id"),
      url.searchParams.get("resourceId"),
    ].filter(Boolean);

  // Evita TS1137: usa una function "classica" (e chiudi bene le righe sopra)
  function toGID(v) {
    const s = String(v).trim();
    return s.startsWith("gid://")
      ? s
      : `gid://shopify/Order/${s.replace(/\D/g, "")}`;
  }

  const orderGIDs = [
    ...url.searchParams.getAll("orderGIDs"),
    ...parseList(url.searchParams.get("orderGIDs")),
    ...parseList(url.searchParams.get("orders")),
    ...parseList(url.searchParams.get("ids")),
    ...idParams.map(toGID),
  ].filter(Boolean);

  // Se ho una selezione, interrogo nodes(ids: ...); altrimenti mostro pagina vuota (nessun throw)
  let orders = [];
  if (orderGIDs.length) {
    const q = `
      query($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Order {
            id
            name
            createdAt
            shippingAddress { name address1 address2 city zip provinceCode countryCodeV2 phone }
            lineItems(first: 20) { edges { node { title quantity sku } } }
          }
        }
      }
    `;
    const resp = await admin.graphql(q, { variables: { ids: orderGIDs } });
    const data = await resp.json();
    orders = (data?.data?.nodes || []).filter(Boolean);
  }

  return json({
    orders,
    orderGIDs,
    shop,
    host,
    defaultFormat,
    defaultTemplate,
  });
}

    export default function PrintLabelsPreview() {
      // ricevi defaultFormat e defaultTemplate come stringhe
      const { orders, orderGIDs, shop, host, defaultFormat, defaultTemplate } = useLoaderData();

    const settingsHref = (() => {
      const qs = new URLSearchParams();
      if (host) qs.set("host", host);
      orderGIDs.forEach(id => qs.append("orderGIDs", id));
      return `/app/settings${qs.toString() ? `?${qs}` : ""}`;
    })();

  // ⬇️ invece di hardcodare "100x150" e "minimal", usi i valori presi da Prisma
  const [format, setFormat] = useState(defaultFormat);
  const [template, setTemplate] = useState(defaultTemplate);

  async function handleDownload() {
    try {
      const ids = (orderGIDs.length ? orderGIDs : orders.map(o => o.id));
      const urlParams =
        `${ids.map((g) => `ids[]=${encodeURIComponent(g)}`).join("&")}` +
        (shop ? `&shop=${encodeURIComponent(shop)}` : "") +
        (host ? `&host=${encodeURIComponent(host)}` : "") +
        `&embedded=1`;

      const res = await fetch(`/app/labels.pdf?${urlParams}&format=${encodeURIComponent(format)}&template=${encodeURIComponent(template)}`, {
        method: "GET",
        credentials: "include", // porta i cookie della sessione embedded
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        alert(`HTTP ${res.status}\n\n${text.slice(0, 500)}`);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Crea un link temporaneo con "download" e cliccalo programmaticamente
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "labels.pdf";     // nome file
      document.body.appendChild(a);
      a.click();
      a.remove();

      // pulizia
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (err) {
      console.error("PDF error:", err);
      alert("Impossibile generare il PDF: " + (err?.message || err));
    }
  }

  const hasOrders = Array.isArray(orders) && orders.length > 0;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>Print Labels – Anteprima</h1>
      {!hasOrders && (
        <div style={{ padding: "8px 12px", marginBottom: 12, border: "1px dashed #aaa", borderRadius: 6, background: "#fffbe6" }}>
          Nessun ordine selezionato. Apri l’estensione da un ordine o da una selezione multipla per visualizzarli qui.
        </div>
      )}

      {hasOrders && orders.map((o) => (
        <div key={o.id} style={{ marginBottom: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div style={{ fontWeight: 700 }}>{o.name}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            {new Date(o.createdAt).toLocaleString()}
          </div>

          <div>
            <div><strong>Destinatario</strong></div>
            <div>{o.shippingAddress?.name || "—"}</div>
            <div>
              {[o.shippingAddress?.address1, o.shippingAddress?.address2].filter(Boolean).join(" ") || "—"}
            </div>
            <div>
              {[o.shippingAddress?.zip, o.shippingAddress?.city, o.shippingAddress?.provinceCode].filter(Boolean).join(" ") || "—"}
            </div>
            <div>{o.shippingAddress?.countryCodeV2 || "—"}</div>
            {o.shippingAddress?.phone && <div>📞 {o.shippingAddress.phone}</div>}
          </div>

          <div style={{ marginTop: 8 }}>
            <div><strong>Articoli</strong></div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(o.lineItems?.edges || []).map((e, i) => (
                <li key={i}>
                  {e.node.quantity} × {e.node.title} {e.node.sku ? `(${e.node.sku})` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}

    <div style={{ margin: "8px 0 16px" }}>
      <label style={{ marginRight: 8 }}><strong>Formato</strong></label>
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value)}
        style={{ padding: 6 }}
      >
        <option value="100x150">100×150 mm (termica)</option>
        <option value="a4-2x3">A4 – 2×3 etichette</option>
        <option value="a4-3x8">A4 – 3×8 (classico foglio etichette)</option>
      </select>
    </div>

    <div style={{ margin: "8px 0 16px" }}>
      <label style={{ marginRight: 8 }}><strong>Template</strong></label>
      <select
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        style={{ padding: 6 }}
      >
        <option value="minimal">Minimal (solo destinatario)</option>
        <option value="shipping">Spedizione (destinatario + articoli)</option>
      </select>
    </div>


      {/* Pulsante per step successivo: PDF */}
      <button
        type="button"           // ✅ evita submit di eventuali form genitore
        onClick={handleDownload}
        style={{
          display: "inline-block",
          padding: "10px 16px",
          background: "#000",
          color: "#fff",
          borderRadius: 6,
          border: "none",
          cursor: "pointer"
        }}
      >
        Scarica PDF etichette
      </button>

      <div>
        <br></br>
            <a href={`/app/settings${host ? `?host=${encodeURIComponent(host)}` : ""}`} style={{ marginLeft: 12 }}>
              Impostazioni
            </a>
      </div>
    </div>
  );
}
