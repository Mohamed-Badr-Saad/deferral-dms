import { randomBytes, createECDH } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toFixedLength(buf, len) {
  if (buf.length === len) return buf;
  if (buf.length > len) return buf.subarray(buf.length - len);
  const out = Buffer.alloc(len);
  buf.copy(out, len - buf.length);
  return out;
}

// Generates a real VAPID (P-256) key pair for web push — NOT random hex.
// Equivalent to what the `web-push` package's generateVAPIDKeys() produces.
function generateVapidKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    publicKey: base64url(ecdh.getPublicKey()),
    privateKey: base64url(toFixedLength(ecdh.getPrivateKey(), 32)),
  };
}

let template = await readFile(new URL("../.env.docker.example", import.meta.url), "utf8");
template = template.replaceAll("REPLACE_WITH_RANDOM_HEX", () => randomBytes(32).toString("hex"));

const vapid = generateVapidKeys();
template = template.replace("REPLACE_WITH_VAPID_PUBLIC_KEY", vapid.publicKey);
template = template.replace("REPLACE_WITH_VAPID_PRIVATE_KEY", vapid.privateKey);

await writeFile(new URL("../.env.docker", import.meta.url), template, { flag: "wx", mode: 0o600 });
console.log("Created .env.docker. Set APP_URL to the IT server URL before deployment. Existing files were not changed.");
console.log("Also review VAPID_SUBJECT (set to a real admin email/URL) before deployment.");
