import { db } from "../database/db";

async function syncRayapudiAnswers() {
  console.log("⚡ CLUCO.AI: Syncing screening answers for Rayapudi Kasi across accounts...");

  const rayapudiCustomAnswers: Record<string, string> = {
    offboarding: "1. Immediately revoke Google Workspace and Okta access privileges. 2. Remote lock and wipe MDM devices. 3. Retrieve hardware assets and log offboarding in IT audit system.",
    outbound: "I would build a modern stack using Apollo/Clay for prospecting, Outreach for sequencing, Salesforce for CRM tracking, and Gong for conversation intelligence.",
    automated: "Repetitive lead enrichment, CRM data sync, and email sequencing should be automated. High-touch discovery calls and relationship management should remain human.",
    troubleshoot: "During my ML projects, I encountered model inference latency bottlenecks. I optimized vector indexing, applied quantization, and refactored API endpoints in Node.js to improve throughput by 50%.",
    why: "I am passionate about Python, ML, and web development, and eager to build scalable AI-driven web products with your team.",
    pronouns: "He/Him",
    phonetic: "ray-ah-POO-dee KAH-see",
    agree: "Yes",
    consent: "Yes",
    sponsorship: "No",
    authorized: "Yes"
  };

  const users = await db.query(
    "SELECT id FROM users WHERE id LIKE 'usr_demo_%' AND id != 'usr_demo_001' AND id != 'usr_demo_002'"
  );

  for (const u of users.rows) {
    for (const [key, val] of Object.entries(rayapudiCustomAnswers)) {
      const answerId = `ans_${u.id}_${key}`;
      await db.query(
        `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
         VALUES ($1, $2, $3, $4, $5, 'USER')
         ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer`,
        [answerId, u.id, key, key, val]
      );
    }
  }

  console.log(`✅ Successfully synced screening answers for ${users.rowCount} Rayapudi Kasi candidate accounts.`);
  await db.close();
  process.exit(0);
}

syncRayapudiAnswers().catch(async (err) => {
  console.error("❌ Failed to sync Rayapudi answers:", err);
  await db.close();
  process.exit(1);
});
