import { db } from "../src/database/db";

async function main() {
  const jobUrl = "https://wellfound.com/jobs/4869796-software-engineer-backend";
  const jobId = "wf_4869796_backend";
  const jobTitle = "Software Engineer - Backend";
  const company = "Wellfound Startup";

  console.log("===============================================================================");
  console.log("📥 ADDING WELLFOUND JOB TO DATABASE");
  console.log(`URL: ${jobUrl}`);
  console.log("===============================================================================\n");

  // 1. Insert or update the job
  await db.query(
    `INSERT INTO public.jobs (id, url, title, company, ats, status, created_at)
     VALUES ($1, $2, $3, $4, 'WELLFOUND', 'PENDING', CURRENT_TIMESTAMP)
     ON CONFLICT (url) DO UPDATE SET ats = 'WELLFOUND', status = 'PENDING'
     RETURNING id, title, company, ats, url`,
    [jobId, jobUrl, jobTitle, company]
  );
  console.log("✅ Successfully inserted/updated job in public.jobs!");

  // 2. Link application to Hrutin Nammi
  const hrutinUser = await db.query("SELECT id FROM public.users WHERE email = 'babufakemail@gmail.com' LIMIT 1");
  const userId = hrutinUser.rows.length > 0 ? hrutinUser.rows[0].id : "usr_hrutin_nammi";

  const resume = await db.query("SELECT id FROM public.resumes WHERE user_id = $1 AND is_active = 1 LIMIT 1", [userId]);
  const resumeId = resume.rows.length > 0 ? resume.rows[0].id : "res_usr_hrutin_nammi";

  const appId = `app_${jobId}`;
  await db.query(
    `INSERT INTO public.applications (id, user_id, job_id, resume_id, ats, status, created_at)
     VALUES ($1, $2, $3, $4, 'WELLFOUND', 'PENDING', CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET status = 'PENDING', ats = 'WELLFOUND'`,
    [appId, userId, jobId, resumeId]
  ).catch(() => {});

  console.log(`✅ Application linked for user ${userId} and resume ${resumeId}`);
  console.log("\n📋 Job successfully queued. Ready to run!");
  await db.close();
}

main().catch(async (err) => {
  console.error("❌ Error adding job:", err);
  await db.close();
  process.exit(1);
});

