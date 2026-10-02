// filepath: src/lib/sharepoint/auth.ts
// MSAL confidential client para SharePoint / Microsoft Graph.
// Usa client_credentials (no interactivo) — el server actúa en nombre
// de la organización, no de un usuario.
//
// Configuración esperada (todas opcionales; si falta alguna, /api/documents/*
// devuelve 503 según docs/specs/document-generation-sharepoint.md §AC-NR-3):
//   SP_TENANT_ID
//   SP_CLIENT_ID
//   SP_CLIENT_SECRET
//   SP_SITE_ID
//   SP_DRIVE_ID
//   SP_BASE_PATH            (default "Proyectos")

import {
  ConfidentialClientApplication,
  type AuthenticationResult,
} from "@azure/msal-node";

export interface SharePointConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  driveId: string;
  basePath: string;
}

export type SharePointConfigResult =
  | { ok: true; config: SharePointConfig }
  | { ok: false; reason: "MISSING_ENV"; missing: string[] };

/**
 * Lee y valida las variables de entorno de SharePoint.
 * No lanza — devuelve un discriminated union para que el caller
 * responda 503 con mensaje claro si falta algo.
 */
export function readSharePointConfig(): SharePointConfigResult {
  const required: (keyof SharePointConfig)[] = [
    "tenantId",
    "clientId",
    "clientSecret",
    "siteId",
    "driveId",
  ];
  const envMap: Record<keyof SharePointConfig, string | undefined> = {
    tenantId: process.env.SP_TENANT_ID,
    clientId: process.env.SP_CLIENT_ID,
    clientSecret: process.env.SP_CLIENT_SECRET,
    siteId: process.env.SP_SITE_ID,
    driveId: process.env.SP_DRIVE_ID,
    basePath: process.env.SP_BASE_PATH,
  };
  const missing = required.filter(
    (k) => !envMap[k] || envMap[k]!.trim() === "",
  );
  if (missing.length > 0) {
    return { ok: false, reason: "MISSING_ENV", missing };
  }
  return {
    ok: true,
    config: {
      tenantId: envMap.tenantId!,
      clientId: envMap.clientId!,
      clientSecret: envMap.clientSecret!,
      siteId: envMap.siteId!,
      driveId: envMap.driveId!,
      basePath: envMap.basePath?.trim() || "Proyectos",
    },
  };
}

/**
 * MSAL singleton. Se inicializa lazily la primera vez que se necesita un token.
 * Cacheamos en globalThis para sobrevivir hot-reload de Next dev.
 */
declare global {
  // eslint-disable-next-line no-var
  var __controlObraMsal: ConfidentialClientApplication | undefined;
}

function getMsal(config: SharePointConfig): ConfidentialClientApplication {
  if (globalThis.__controlObraMsal) return globalThis.__controlObraMsal;
  globalThis.__controlObraMsal = new ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      clientSecret: config.clientSecret,
    },
  });
  return globalThis.__controlObraMsal;
}

/**
 * Devuelve un token válido para Microsoft Graph (.default scope).
 * MSAL cachea tokens internamente, así que es barato llamar varias veces.
 * Throws si no se puede obtener — el caller mapea a SP_AUTH_FAILED.
 */
export async function getGraphToken(config: SharePointConfig): Promise<string> {
  const msal = getMsal(config);
  const result: AuthenticationResult | null =
    await msal.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });
  if (!result?.accessToken) {
    throw new Error("SP_AUTH_FAILED: MSAL no devolvió accessToken");
  }
  return result.accessToken;
}

/**
 * Resetea el singleton de MSAL. Solo para tests.
 */
export function _resetMsalForTests(): void {
  globalThis.__controlObraMsal = undefined;
}
