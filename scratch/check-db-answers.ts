import { db } from "../src/database/db";

async function main() {
  const count = await db.query("SELECT count(*) FROM user_saved_answers WHERE user_id = 'usr_hrutin_nammi'");
  console.log("Total saved answers for Hrutin Nammi:", count.rows[0].count);
  
  const latest = await db.query("SELECT normalized_question, answer, source, updated_at FROM user_saved_answers WHERE user_id = 'usr_hrutin_nammi' ORDER BY updated_at DESC LIMIT 15");
  console.log("\nLatest 15 answers saved into database:");
  for (const r of latest.rows) {
    console.log(`- [${r.source || 'LLM'}] "${r.normalized_question.slice(0, 50)}" -> "${r.answer.slice(0, 50)}..." (${r.updated_at})`);
  }
  process.exit(0);
}

main().catch(console.error);
