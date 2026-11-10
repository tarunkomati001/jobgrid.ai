import { db } from "../src/database/db";

async function main() {
  const user = await db.query("SELECT * FROM user_profiles WHERE user_id = $1", ["usr_hrutin_nammi"]);
  console.log("User profile:", user.rows[0]);
  const answers = await db.query("SELECT normalized_question, answer FROM user_saved_answers WHERE user_id = $1", ["usr_hrutin_nammi"]);
  console.log("Saved answers count:", answers.rows.length);
  for (const row of answers.rows) {
    console.log(`  "${row.normalized_question}": "${row.answer}"`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
