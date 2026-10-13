import { db } from "../src/db";

async function run() {
  const res = await db.query("SELECT id, first_name, last_name, email FROM users");
  console.log("Users in DB:", res.rows);
  await db.close();
}
run();
