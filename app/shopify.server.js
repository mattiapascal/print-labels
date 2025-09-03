// app/shopify.server.js
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { prisma } from "./db.server"; // ✅ named export

// ✅ Una sola istanza di storage, con opzioni a prova di versione
const sessionStorage = new PrismaSessionStorage(prisma, {
  // alcune versioni usano queste chiavi:
  session: "Session",
  appInstallation: "AppInstallation",
  // altre versioni usano queste:
  sessionModel: "Session",
  appInstallationModel: "AppInstallation",
});

export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.January25,
  scopes: (process.env.SCOPES || "").split(",").filter(Boolean),
  appUrl: process.env.SHOPIFY_APP_URL,
  authPathPrefix: "/auth",
  distribution: AppDistribution.SingleMerchant, // ✅ sei in custom/single-merchant
  sessionStorage, // ✅ usa SOLO questo, niente doppioni
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

// Assert chiari in dev:
if (!process.env.SHOPIFY_API_SECRET) {
  throw new Error("Missing SHOPIFY_API_SECRET in .env");
}
if (!process.env.SHOPIFY_APP_URL) {
  throw new Error("Missing SHOPIFY_APP_URL in .env (set your current tunnel URL)");
}
console.log("[APP_URL]", process.env.SHOPIFY_APP_URL);


export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
