const { Client } = require("pg");

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  try {
    await client.connect();
    const res = await client.query("select now()");
    console.log("Connected OK:", res.rows[0]);
  } catch (e) {
    console.error("Connection failed:", e);
  } finally {
    await client.end();
  }
})();
