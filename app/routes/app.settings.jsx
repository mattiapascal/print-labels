// app/routes/app.settings.jsx
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const host = url.searchParams.get("host") || null;
  const shop = session.shop;
  const settings = await prisma.shopSetting.findUnique({ where: { shop } });
  return json({
    shop,
    host,
    defaultFormat: settings?.defaultFormat || "100x150",
    defaultTemplate: settings?.defaultTemplate || "minimal",
  });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const form = await request.formData();
  const defaultFormat = String(form.get("defaultFormat") || "100x150");
  const defaultTemplate = String(form.get("defaultTemplate") || "minimal");

  await prisma.shopSetting.upsert({
    where: { shop },
    create: { shop, defaultFormat, defaultTemplate },
    update: { defaultFormat, defaultTemplate },
  });

  return redirect("/app/settings?saved=1");
}

export default function SettingsPage() {
  const { defaultFormat, defaultTemplate } = useLoaderData();
  const nav = useNavigation();
  const saving = nav.state !== "idle";

  return (
    <div style={{ padding: 24, maxWidth: 540 }}>
      <h1>Impostazioni etichette</h1>

      <Form method="post" replace>
        <div style={{ margin: "16px 0" }}>
          <label><strong>Formato predefinito</strong></label><br />
          <select name="defaultFormat" defaultValue={defaultFormat} style={{ padding: 6, width: "100%" }}>
            <option value="100x150">100×150 mm (termica)</option>
            <option value="a4-2x3">A4 – 2×3 etichette</option>
            <option value="a4-3x8">A4 – 3×8 etichette</option>
          </select>
        </div>

        <div style={{ margin: "16px 0" }}>
          <label><strong>Template predefinito</strong></label><br />
          <select name="defaultTemplate" defaultValue={defaultTemplate} style={{ padding: 6, width: "100%" }}>
            <option value="minimal">Minimal (solo destinatario)</option>
            <option value="shipping">Spedizione (con articoli)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ padding: "10px 16px", background: "#000", color: "#fff", borderRadius: 6, border: "none", cursor: "pointer" }}
        >
          {saving ? "Salvataggio…" : "Salva impostazioni"}
        </button>

        <a href={`/app/print-labels${new URLSearchParams(location.search).get('host') ? `?host=${encodeURIComponent(new URLSearchParams(location.search).get('host'))}` : ''}`} style={{ marginLeft: 12 }}>Torna a Print Labels</a>
      </Form>
    </div>
  );
}
