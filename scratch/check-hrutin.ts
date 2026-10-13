import { db } from "../src/database/db";

async function main() {
  const u = await db.query("SELECT * FROM users WHERE email LIKE '%hrutin%' OR email = 'babufakemail@gmail.com'");
  console.log("User:", u.rows);
  if (u.rows.length) {
    const p = await db.query("SELECT * FROM user_profiles WHERE user_id = $1", [u.rows[0].id]);
    console.log("Profile:", p.rows);
    const r = await db.query("SELECT * FROM resumes WHERE user_id = $1", [u.rows[0].id]);
    console.log("Resume:", r.rows);
  }
  await db.close();
}

main().catch(console.error);
