import { db } from "../src/database/db";

async function main() {
  const res = await db.query(
    "UPDATE user_profiles SET location = $1 WHERE user_id = $2 OR user_id IN (SELECT id FROM users WHERE email = $3)",
    ["ava street, vadodar, Gujarat, 390144, India", "usr_hrutin_nammi", "babufakemail@gmail.com"]
  );
  console.log("Updated user_profiles rows:", res.rowCount);
  await db.close();
}

main().catch(console.error);
