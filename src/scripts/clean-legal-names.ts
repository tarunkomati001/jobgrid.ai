import { db } from "../database/db";

async function cleanLegalNames() {
  console.log("⚡ CLUCO.AI: Cleaning legal_name & name answers in user_saved_answers database...");

  const users = await db.query(
    "SELECT p.user_id, p.first_name, p.last_name FROM user_profiles p"
  );

  for (const u of users.rows) {
    const fullName = `${u.first_name} ${u.last_name}`;
    await db.query(
      `UPDATE user_saved_answers 
       SET answer = $1 
       WHERE user_id = $2 AND (normalized_question LIKE '%legal_name%' OR normalized_question LIKE '%legal name%')`,
      [fullName, u.user_id]
    );
  }

  console.log("✅ Successfully updated legal_name saved answers across all users.");
  await db.close();
  process.exit(0);
}

cleanLegalNames().catch(async (err) => {
  console.error("❌ Failed to clean legal names:", err);
  await db.close();
  process.exit(1);
});
