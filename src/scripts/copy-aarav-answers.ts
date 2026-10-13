import { db } from "../database/db";

async function copyAaravAnswersToAllUsers() {
  console.log("⚡ CLUCO.AI: Copying all of Aarav Mehta's saved answers & screening responses to ALL users...");

  // 1. Get all saved answers from Aarav Mehta
  const aaravAnswersRes = await db.query(
    `SELECT normalized_question, original_question, answer, source 
     FROM user_saved_answers 
     WHERE user_id = 'bb5c54fd-79ee-41fd-917b-6553a09195d1' OR user_id = 'usr_demo_001'`
  );

  if (aaravAnswersRes.rowCount === 0) {
    console.error("❌ No saved answers found for Aarav Mehta!");
    await db.close();
    process.exit(1);
  }

  const aaravAnswers = aaravAnswersRes.rows;
  console.log(`📋 Found ${aaravAnswers.length} saved answer(s) from Aarav Mehta.`);

  // 2. Fetch all users from database
  const usersRes = await db.query("SELECT id, email FROM users");
  const allUsers = usersRes.rows;
  console.log(`👤 Copying answers to ${allUsers.length} user profile(s) in database...\n`);

  let totalCopied = 0;

  for (const user of allUsers) {
    let userCopiedCount = 0;
    for (const ans of aaravAnswers) {
      const answerId = `ans_${user.id}_${ans.normalized_question}`.substring(0, 100);
      await db.query(
        `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer`,
        [answerId, user.id, ans.normalized_question, ans.original_question, ans.answer, ans.source || "USER"]
      );
      userCopiedCount++;
      totalCopied++;
    }
    console.log(`  ✅ Successfully updated ${userCopiedCount} saved answers for user ${user.id} (${user.email})`);
  }

  console.log(`\n🎉 Completed! Total ${totalCopied} answer record(s) synced across all ${allUsers.length} users.`);
  await db.close();
  process.exit(0);
}

copyAaravAnswersToAllUsers().catch(async (err) => {
  console.error("❌ Script error:", err);
  await db.close();
  process.exit(1);
});
