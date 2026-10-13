import { db } from "../src/database/db";

async function main() {
  const p = await db.query("SELECT user_id, first_name, last_name, location, gender, years_of_experience FROM user_profiles");
  console.log("PROFILES:", JSON.stringify(p.rows, null, 2));

  const answers = await db.query("SELECT normalized_question, answer FROM user_saved_answers WHERE normalized_question LIKE '%gender%' OR normalized_question LIKE '%location%'");
  console.log("SAVED ANSWERS (gender/location):", JSON.stringify(answers.rows, null, 2));

  const jobs = await db.query("SELECT url, title, company, ats FROM jobs WHERE ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%'");
  console.log("WORKDAY JOBS:", JSON.stringify(jobs.rows, null, 2));

  await db.close();
}

main().catch(console.error);
