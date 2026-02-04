import { Pool } from "pg";

const BASE_URL = "http://localhost:3000";
const PASSWORD = "123456789";
const ORIGIN = "http://localhost:3000";

const roles = [
  "ENGINEER_APPLICANT",
  "DEPARTMENT_HEAD",
  "RELIABILITY_ENGINEER",
  "RELIABILITY_GM",
  "RESPONSIBLE_GM",
  "SOD",
  "DFGM",
  "TECHNICAL_AUTHORITY",
  "AD_HOC",
  "PLANNING_ENGINEER",
  "PLANNING_SUPERVISOR_ENGINEER",
  "ADMIN",
];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in the environment.");
  process.exit(1);
}

async function signup(role) {
  const email = `${role.toLowerCase()}@rashpetco.com`;


const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Origin": ORIGIN,
    "Host": "localhost:3000",
  },
  body: JSON.stringify({
    email,
    password: PASSWORD,
    name: role.replaceAll("_", " "),
  }),
});

  if (!res.ok) {
    const txt = await res.text();
    console.log(`⚠️ Signup failed for ${email}: ${txt}`);
    return;
  }

  console.log(`✅ Signed up: ${email}`);
}

async function updateRoles() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  for (const role of roles) {
    const email = `${role.toLowerCase()}@rashpetco.com`;
    await pool.query(
      `UPDATE users SET role = $1, updated_at = now() WHERE email = $2`,
      [role, email]
    );
    console.log(`🔧 Role set: ${email} → ${role}`);
  }

  await pool.end();
}

async function run() {
  for (const role of roles) {
    await signup(role);
  }
  await updateRoles();
  console.log("🎉 Done.");
}

run().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
