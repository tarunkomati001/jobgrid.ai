import { db } from "../database/db";
import { v4 as uuidv4 } from "uuid";

interface JobSeed {
  url: string;
  title: string;
  company: string;
  description: string;
}

const jazzhrJobs: JobSeed[] = [
  {
    url: "https://snapsheet.applytojob.com/apply/7dY1TUAJrl/Account-Manager-Appraisals",
    title: "Account Manager - Appraisals",
    company: "Snapsheet",
    description: "Account Manager position at Snapsheet managing virtual vehicle appraisals and client relationships."
  },
  {
    url: "https://snapsheet.applytojob.com/apply/c1KTdrlE1X/Quality-Assurance-Engineer",
    title: "Quality Assurance Engineer",
    company: "Snapsheet",
    description: "Quality Assurance Engineer at Snapsheet testing automated claims management software and APIs."
  },
  {
    url: "https://snapsheet.applytojob.com/apply/zbmXAVAZXm/Senior-Account-Executive",
    title: "Senior Account Executive",
    company: "Snapsheet",
    description: "Senior Account Executive driving enterprise sales and customer partnerships at Snapsheet."
  },
  {
    url: "https://peregrineteam.applytojob.com/apply/ppXpgq8Ykg/Software-Engineer",
    title: "Software Engineer",
    company: "Peregrine Team",
    description: "Software Engineer developing scalable web applications and distributed backend architectures."
  },
  {
    url: "https://eclipsefoundation.applytojob.com/apply/yxw4F4HTOW/Intermediate-SecOps-Engineer",
    title: "Intermediate SecOps Engineer",
    company: "Eclipse Foundation, Inc.",
    description: "Intermediate SecOps Engineer securing infrastructure, detection engineering, and incident response."
  },
  {
    url: "https://bibleproject.applytojob.com/apply/CIsBvf6BHr/Quality-Engineer-Mobile-Audience-Experience",
    title: "Quality Engineer- Mobile, Audience Experience",
    company: "BibleProject",
    description: "Mobile Quality Engineer testing iOS and Android applications, automated test suites and audience experience."
  },
  {
    url: "https://vivsofttechnologiesfa.applytojob.com/apply/1kNuql214Y/OneStream-Developer",
    title: "OneStream Developer",
    company: "VivSoft Technologies",
    description: "OneStream Developer delivering enterprise financial and performance management cloud solutions."
  },
  {
    url: "https://vivsofttechnologiesfa.applytojob.com/apply/ECytI4yKss/Salesforce-Developer",
    title: "Salesforce Developer",
    company: "VivSoft Technologies",
    description: "Salesforce Developer implementing custom Apex, Lightning Web Components, and integration workflows."
  }
];

async function seed() {
  console.log("🌱 Seeding JazzHR Jobs into database...");
  
  // Find Hrutin Nammi
  const hrutinUser = await db.query(
    "SELECT u.id, u.email FROM users u JOIN user_profiles p ON u.id = p.user_id WHERE u.email LIKE '%hrutin%' OR p.first_name ILIKE '%hrutin%' LIMIT 1"
  );
  const userId = hrutinUser.rows[0]?.id || "usr_hrutin_nammi";
  console.log(`👤 Linking to candidate user: ${userId} (${hrutinUser.rows[0]?.email || 'Hrutin'})`);

  // Resume ID
  const resumeRes = await db.query("SELECT id FROM resumes WHERE user_id = $1 LIMIT 1", [userId]);
  const resumeId = resumeRes.rows[0]?.id || "res_usr_hrutin_nammi";

  for (const job of jazzhrJobs) {
    let jobId: string;
    const existing = await db.query("SELECT id FROM jobs WHERE url = $1", [job.url]);
    if (existing.rowCount && existing.rowCount > 0) {
      jobId = existing.rows[0].id;
      await db.query(
        "UPDATE jobs SET company = $1, title = $2, description = $3, ats = 'JAZZHR', status = 'EXTRACTED' WHERE id = $4",
        [job.company, job.title, job.description, jobId]
      );
      console.log(`🔄 Updated existing Job: ${job.title} at ${job.company} (${jobId})`);
    } else {
      jobId = uuidv4();
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status)
         VALUES ($1, $2, $3, $4, $5, 'JAZZHR', 'EXTRACTED')`,
        [jobId, job.url, job.company, job.title, job.description]
      );
      console.log(`➕ Inserted Job: ${job.title} at ${job.company} (${jobId})`);
    }

    // Ensure Application record
    const appCheck = await db.query("SELECT id FROM applications WHERE user_id = $1 AND job_id = $2", [userId, jobId]);
    if (appCheck.rowCount === 0) {
      await db.query(
        `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
         VALUES ($1, $2, $3, $4, 'JAZZHR', 'PENDING')`,
        [uuidv4(), userId, jobId, resumeId]
      );
      console.log(`   ➕ Created Application record for job ${jobId}`);
    }
  }

  console.log("✅ Finished seeding JazzHR jobs!");
  await db.close();
}

seed().catch(err => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});

