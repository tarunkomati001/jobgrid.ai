import { db } from "../src/database/db";

async function main() {
  const user = await db.query("SELECT * FROM users WHERE email LIKE '%hrutin%'");
  console.log("Hrutin User:", user.rows);
  if (user.rows.length > 0) {
    const profile = await db.query("SELECT * FROM user_profiles WHERE user_id = $1", [user.rows[0].id]);
    console.log("Hrutin Profile:", profile.rows);
    const resume = await db.query("SELECT * FROM resumes WHERE user_id = $1", [user.rows[0].id]);
    console.log("Hrutin Resumes:", resume.rows);
  }
  await db.close();
}

main().catch(console.error);
