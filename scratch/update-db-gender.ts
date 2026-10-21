import { db } from "../src/database/db";

async function main() {
  console.log("Updating gender values in database to 'Male'...");

  // 1. Update user_profiles
  const profRes = await db.query(
    "UPDATE public.user_profiles SET gender = 'Male' RETURNING user_id, first_name, gender"
  );
  console.log("Updated user_profiles:", profRes.rows);

  // 2. Update user_saved_answers
  const ansRes = await db.query(
    "UPDATE public.user_saved_answers SET answer = 'Male' WHERE normalized_question IN ('gender', 'gender_identity', 'what_is_your_gender', 'what_is_your_gender_identity') RETURNING user_id, normalized_question, answer"
  );
  console.log("Updated user_saved_answers:", ansRes.rows);

  await db.query("UPDATE public.user_saved_answers SET answer = 'No' WHERE normalized_question LIKE '%transgender%'");
  await db.query("UPDATE public.user_saved_answers SET answer = 'N/A' WHERE normalized_question LIKE '%alternate_gender%'");

  // 3. Verify
  const check = await db.query(
    "SELECT normalized_question, answer FROM public.user_saved_answers WHERE normalized_question LIKE '%gender%'"
  );
  console.log("Verified saved answers:", check.rows);

  await db.close();
}

main().catch(async (e) => {
  console.error(e);
  await db.close();
});
