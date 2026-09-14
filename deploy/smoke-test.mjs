import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

if (!process.argv.includes("--create-test-data")) {
  throw new Error("Use --create-test-data on a test installation. This creates an account and signature.");
}
const base = process.env.TEST_BASE_URL ?? "http://localhost:8080";
let cookie = "";
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { origin: base, cookie, ...options.headers },
    signal: AbortSignal.timeout(60000),
  });
  assert.ok(response.ok, `${path}: HTTP ${response.status}: ${response.ok ? "" : await response.text()}`);
  const cookies = response.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  return response;
}
const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
await request("/api/health/live");
const email = `docker-smoke-${Date.now()}@example.com`;
const password = randomBytes(24).toString("hex");
await request("/api/signup", json({ email, password, name: "Docker Smoke Test", department: "Instrument", position: "Test Engineer" }));
await request("/api/auth/sign-in/email", json({ email, password }));
assert.ok(cookie, "Login must set a session cookie");
await request("/api/deferrals?mode=items&scope=all&pageSize=1");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const form = new FormData();
form.append("file", new Blob([png], { type: "image/png" }), "docker-smoke.png");
const upload = await (await request("/api/profile/signature", { method: "POST", body: form })).json();
assert.ok(upload.signatureUrl.startsWith("/uploads/"), "Must use local storage");
const downloaded = Buffer.from(await (await request(upload.signatureUrl)).arrayBuffer());
assert.deepEqual(downloaded, png, "Uploaded file must be immediately accessible and unchanged");
const { item: draft } = await (await request("/api/deferrals", json({ workOrderTitle: "Docker smoke test" }))).json();
const attachments = new FormData();
attachments.append("files", new Blob([png], { type: "image/png" }), "docker-smoke.png");
const attached = await (await request(`/api/deferrals/${draft.id}/attachments`, { method: "POST", body: attachments })).json();
assert.equal(attached.items.length, 1);
assert.deepEqual(Buffer.from(await (await request(attached.items[0].filePath)).arrayBuffer()), png);
const pdf = Buffer.from(await (await request(`/api/deferrals/${draft.id}/pdf`)).arrayBuffer());
assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
await request(`/api/deferrals/${draft.id}`, { method: "DELETE" });
await request("/api/auth/sign-out", json({}));
console.log(`PASS: liveness, signup, login, search, local signature/attachment upload/download, PDF export, draft deletion, logout. Test account and signature retained: ${email}`);
