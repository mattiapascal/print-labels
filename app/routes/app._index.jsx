// app/routes/app._index.jsx
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request); // session ok (gestisce reauth)
  const url = new URL(request.url);
  // preserva TUTTI i query param (host, orderGIDs, ecc.)
  return redirect(`/app/print-labels${url.search || ""}`);
}

export default function AppIndexRedirect() {
  return null; // non si renderizza, serve solo per completezza
}
