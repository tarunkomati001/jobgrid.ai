import { db } from "../database/db";

async function updateTarunEmails() {
  console.log("⚡ CLUCO.AI: Setting Komati Tarun emails across candidate accounts...");

  const users = await db.query("SELECT id FROM users WHERE id LIKE 'usr_demo_%' AND id != 'usr_demo_001' ORDER BY id ASC");
  
  let idx = 2;
  for (const u of users.rows) {
    const email = idx === 2 ? "tarunkomati2@gmail.com" : `tarunkomati2+user${idx}@gmail.com`;
    await db.query("UPDATE users SET email = $1 WHERE id = $2", [email, u.id]);
    idx++;
  }

  console.log("✅ Updated emails for all Komati Tarun candidate accounts.");

  const verify = await db.query(
    "SELECT p.user_id, p.first_name, p.last_name, u.email FROM user_profiles p JOIN users u ON p.user_id = u.id ORDER BY p.user_id ASC"
  );

  console.log("\n📋 Final Clean User Roster in Database:");
  verify.rows.forEach((u: any, i: number) => {
    console.log(`   [User ${i + 1}] Name: ${u.first_name} ${u.last_name} | Email: ${u.email}`);
  });

  await db.close();
  process.exit(0);
}

updateTarunEmails().catch(async (err) => {
  console.error("❌ Failed to update emails:", err);
  await db.close();
  process.exit(1);
});
