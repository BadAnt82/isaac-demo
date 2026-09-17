#!/usr/bin/env node

/**
 * Deploy the Isaac-Demo repository to its one permitted Coolify application.
 *
 * Required environment variables:
 *   ISAAC_DEPLOY_TOKEN  A Coolify API token with deploy permission only.
 *   COOLIFY_URL         Optional; defaults to the production Coolify URL.
 *
 * The application UUID and endpoint are intentionally fixed. There is no
 * command-line target, domain, or resource override.
 */

const appUuid = "afcmgbwczypcqtxcugqpein8";
const coolifyUrl = (process.env.COOLIFY_URL || "http://65.108.216.96:8000").replace(/\/$/, "");
const token = process.env.ISAAC_DEPLOY_TOKEN;

if (!token) {
  console.error("Missing ISAAC_DEPLOY_TOKEN. Use a Coolify deploy-only token for the Isaac app.");
  process.exit(1);
}

const endpoint = `${coolifyUrl}/api/v1/deploy?uuid=${appUuid}&force=false`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
});

const body = await response.text();
if (!response.ok) {
  console.error(`Isaac deployment request failed (${response.status}).`);
  if (body) console.error(body.slice(0, 500));
  process.exit(1);
}

console.log("Isaac deployment queued.");
if (body) console.log(body);
