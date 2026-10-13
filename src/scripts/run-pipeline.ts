import { db } from "../database/db";

async function main() {
  console.log("🌱 [Pipeline Runner]: Initializing database seed...");
  
  const seedRes = await fetch("http://127.0.0.1:3000/seed", { method: "POST" });
  const seedData = await seedRes.json();
  console.log("✅ Seed completed:", seedData.message);
  
  const userId = seedData.data.userId;
  const url = "https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application";
  
  console.log(`📥 [Pipeline Runner]: Enqueuing job: ${url}`);
  const jobBody = {
    url,
    userId,
    additionalAnswers: {
      "Pronouns": "He",
      "Do you speak fluent German?": "No",
      "Can you commit to working from one of our offices on Anchor Days each week?": "No",
      "Will you now or in the future require Notion to sponsor you in an immigration case in order to employ you?": "Yes",
      "How did you hear about this opportunity?": "LinkedIn"
    }
  };
  
  const enqueueRes = await fetch("http://127.0.0.1:3000/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jobBody)
  });
  
  const enqueueData = await enqueueRes.json();
  if (!enqueueData.success) {
    console.error("❌ Failed to enqueue job:", enqueueData.error);
    process.exit(1);
  }
  
  const applicationId = enqueueData.data.applicationId;
  console.log(`✅ Job enqueued! Application ID: ${applicationId}`);
  console.log("⏳ [Pipeline Runner]: Waiting for background worker to process application...");
  
  // Poll application status
  let attempts = 0;
  const maxAttempts = 30;
  let status = "PENDING";
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    attempts++;
    
    const appQuery = await db.query("SELECT status, error_message FROM applications WHERE id = $1", [applicationId]);
    if (appQuery.rowCount > 0) {
      status = appQuery.rows[0].status;
      const errorMsg = appQuery.rows[0].error_message;
      
      console.log(`[Status Poll]: Status = ${status} (Attempt ${attempts}/${maxAttempts})`);
      
      if (status === "SUBMITTED" || status === "FAILED") {
        if (status === "FAILED") {
          console.error(`❌ Application failed with error: ${errorMsg}`);
        } else {
          console.log("🎉 Application submitted successfully!");
        }
        break;
      }
    }
  }
  
  // Dump audit trail events
  console.log("\n📊 [Audit Trail Events]:");
  const eventsRes = await db.query(
    "SELECT event_type, metadata, created_at FROM application_events WHERE application_id = $1 ORDER BY created_at ASC",
    [applicationId]
  );
  
  eventsRes.rows.forEach((row: any) => {
    console.log(`- [${row.created_at}] ${row.event_type} -> ${row.metadata}`);
  });
  
  // Dump dashboard statistics
  const statsRes = await fetch("http://127.0.0.1:3000/applications/stats");
  const statsData = await statsRes.json();
  console.log("\n📈 [Stats Dashboard]:");
  console.log(JSON.stringify(statsData.stats, null, 2));
  
  await db.close();
}

main().catch(console.error);
