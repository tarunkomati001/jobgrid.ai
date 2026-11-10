import { db } from "../src/database/db";

async function main() {
  const res = await db.query(
    "SELECT normalized_question, original_question, answer FROM user_saved_answers WHERE user_id = 'usr_hrutin_nammi' ORDER BY normalized_question ASC"
  );
  console.log(`Found ${res.rows.length} saved answers:`);
  for (const row of res.rows) {
    if (row.answer.includes("x.com") || row.answer.includes("linkedin")) {
      console.log(`[${row.normalized_question}] => "${row.answer}"`);
    }
  }
  await db.close();
}

main();
