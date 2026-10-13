import { db } from "../database/db";

async function cleanDuplicateAarav() {
  console.log("⚡ CLUCO.AI: Cleaning duplicate Aarav Mehta records in database...");

  const dupId = "bb5c54fd-79ee-41fd-917b-6553a09195d1";

  // Delete dependent rows first
  await db.query("DELETE FROM applications WHERE user_id = $1", [dupId]);
  await db.query("DELETE FROM resumes WHERE user_id = $1", [dupId]);
  await db.query("DELETE FROM user_saved_answers WHERE user_id = $1", [dupId]);
  await db.query("DELETE FROM user_profiles WHERE user_id = $1", [dupId]);
  await db.query("DELETE FROM users WHERE id = $1", [dupId]);

  console.log("✅ Successfully removed duplicate Aarav Mehta record.");

  // Verify remaining users
  const users = await db.query(
    "SELECT p.user_id, p.first_name, p.last_name, u.email FROM user_profiles p JOIN users u ON p.user_id = u.id ORDER BY p.user_id ASC"
  );
  console.log(`\n📋 Found ${users.rowCount} User Profiles in DB:`);
  users.rows.forEach((u: any, idx: number) => {
    console.log(`   [User ${idx + 1}] ID: ${u.user_id} | Name: ${u.first_name} ${u.last_name} | Email: ${u.email}`);
  });

  await db.close();
  process.exit(0);
}

cleanDuplicateAarav().catch(async (err) => {
  console.error("❌ Failed to clean duplicate Aarav:", err);
  await db.close();
  process.exit(1);
});
