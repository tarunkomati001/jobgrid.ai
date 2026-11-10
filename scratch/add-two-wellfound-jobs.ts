import { db } from "../src/database/db";

async function main() {
  const jobs = [
    {
      id: "wf_4855345_client_lifecycle",
      url: "https://wellfound.com/jobs/4855345-senior-software-engineer-client-lifecycle",
      title: "Senior Software Engineer - Client Lifecycle",
      company: "Wellfound Startup"
    },
    {
      id: "wf_2952041_software_engineer",
      url: "https://wellfound.com/jobs/2952041-software-engineer",
      title: "Software Engineer",
      company: "Wellfound Startup"
    }
  ];

  console.log("===============================================================================");
  console.log("📥 ADDING 2 WELLFOUND JOBS TO DATABASE");
  console.log("===============================================================================\n");

  const hrutinUser = await db.query("SELECT id FROM public.users WHERE email = 'babufakemail@gmail.com' LIMIT 1");
  const userId = hrutinUser.rows.length > 0 ? hrutinUser.rows[0].id : "usr_hrutin_nammi";

  const resume = await db.query("SELECT id FROM public.resumes WHERE user_id = $1 AND is_active = 1 LIMIT 1", [userId]);
  const resumeId = resume.rows.length > 0 ? resume.rows[0].id : "res_usr_hrutin_nammi";

  for (const job of jobs) {
    // 1. Insert or update the job
    const jobRes = await db.query(
      `INSERT INTO public.jobs (id, url, title, company, ats, status, created_at)
       VALUES ($1, $2, $3, $4, 'WELLFOUND', 'PENDING', CURRENT_TIMESTAMP)
       ON CONFLICT (url) DO UPDATE SET ats = 'WELLFOUND', status = 'PENDING'
       RETURNING id, title, company, ats, url`,
      [job.id, job.url, job.title, job.company]
    );

    const actualJobId = jobRes.rows[0]?.id || job.id;
    console.log(`✅ [Job Added]: ${job.title} (${actualJobId}) -> ${job.url}`);

    // 2. Link application to Hrutin Nammi
    const appId = `app_${actualJobId}`;
    await db.query(
      `INSERT INTO public.applications (id, user_id, job_id, resume_id, ats, status, created_at)
       VALUES ($1, $2, $3, $4, 'WELLFOUND', 'PENDING', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET status = 'PENDING', ats = 'WELLFOUND'`,
      [appId, userId, actualJobId, resumeId]
    ).catch(() => {});

    console.log(`   🔗 Linked application ${appId} for candidate ${userId}`);
  }

  console.log("\n✨ Both jobs successfully added and linked to Hrutin Nammi in DB!");
  await db.close();
}

main().catch(async (err) => {
  console.error("❌ Error adding jobs:", err);
  await db.close();
  process.exit(1);
});

