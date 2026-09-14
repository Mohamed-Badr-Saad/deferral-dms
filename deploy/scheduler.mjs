import { setTimeout as sleep } from "node:timers/promises";

if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET is required");
const jobs = [
  { path: "expiry-notifications", minute: 0 },
  { path: "mark-expired", minute: 5 },
];
const completed = new Map();
async function run(job) {
  const response = await fetch(`${process.env.JOB_BASE_URL ?? "http://app:3000"}/api/cron/${job.path}`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  await response.json();
  console.log(`${new Date().toISOString()} ${job.path} completed`);
}
if (process.argv.includes("--once")) {
  for (const job of jobs) await run(job);
} else {
  // Same UTC schedule as vercel.json; catch up after downtime and retry failures.
  for (;;) {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    for (const job of jobs) {
      if (now.getUTCHours() * 60 + now.getUTCMinutes() < 120 + job.minute || completed.get(job.path) === day) continue;
      try {
        await run(job);
        completed.set(job.path, day);
      } catch (error) {
        console.error(`${job.path} failed: ${error.message}; retrying in one minute`);
      }
    }
    await sleep(60000);
  }
}
