import { db } from "../src/database/db";

async function main() {
  const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log("=== TABLES IN DB ===");
  console.log(tables.rows.map(r => r.table_name).join(", "));

  const profileCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profiles' ORDER BY ordinal_position");
  console.log("\n=== USER_PROFILES COLUMNS ===");
  console.log(profileCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(", "));

  const users = await db.query("SELECT u.id, u.email, p.first_name, p.last_name, p.location, p.phone, p.work_authorization FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id");
  console.log("\n=== USERS IN DB ===");
  console.log(users.rows);

  const resumes = await db.query("SELECT r.id, r.user_id, r.file_name, r.file_path, r.is_active FROM resumes r");
  console.log("\n=== RESUMES IN DB ===");
  console.log(resumes.rows);

  const answersSample = await db.query("SELECT user_id, normalized_question, answer FROM user_saved_answers LIMIT 15");
  console.log("\n=== USER_SAVED_ANSWERS SAMPLE ===");
  console.log(answersSample.rows);

  await db.close();
}

main().catch(console.error);
