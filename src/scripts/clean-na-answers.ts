import { db } from "../database/db";

async function cleanNAAnswers() {
  console.log("⚡ CLUCO.AI: Cleaning legacy 'N/A' answers in database...");

  const res1 = await db.query(
    "UPDATE user_saved_answers SET answer = 'Yes' WHERE answer = 'N/A' AND (normalized_question LIKE '%agree%' OR normalized_question LIKE '%consent%' OR normalized_question LIKE '%term%')"
  );

  const res2 = await db.query(
    "UPDATE user_saved_answers SET answer = 'I am a dedicated Frontend Developer passionate about building high-performance web applications and leveraging modern software solutions.' WHERE answer = 'N/A'"
  );

  console.log(`✅ Updated ${res1.rowCount} agreement answers to 'Yes'.`);
  console.log(`✅ Updated ${res2.rowCount} general N/A answers to professional responses.`);

  await db.close();
  process.exit(0);
}

cleanNAAnswers().catch(async (err) => {
  console.error("❌ Failed to clean N/A answers:", err);
  await db.close();
  process.exit(1);
});
