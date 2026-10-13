import { db } from "../database/db";
import { v4 as uuidv4 } from "uuid";
import { detectATSByUrl } from "../ats/ats-detector";

const JOB_URLS = [
  "https://www.ashbyhq.com/careers?ashby_location_id=9c7cb4a1-489c-4550-a4ca-a667a981275c&ashby_jid=95aecf44-abba-4d06-8fea-7987b6ea9db5",
  "https://www.ashbyhq.com/careers?ashby_jid=033ce772-ed08-4a59-bb52-4ff0eaac9bcd",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_jid=7a3ff629-6c67-4aa5-bea4-f1d88b3b4777",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_jid=6a15668c-3f98-4404-8f1f-927cddfc5af7",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_jid=cb45928e-c7c7-4163-84d0-a962755a3593",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_department_id=2c32d70f-d7cb-4a06-bd87-048084e3eb10&ashby_jid=0020099f-9bb3-4da9-9808-4556564f5301",
  "https://www.ashbyhq.com/careers?ashby_workplace_type=Remote&ashby_department_id=2c32d70f-d7cb-4a06-bd87-048084e3eb10&ashby_jid=695b1ce6-c375-4fad-94ef-61b50a3fbd28",
  "https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application",
  "https://jobs.ashbyhq.com/ramp/4bc09b14-0389-40cd-9d5b-f5557f451d50/application",
  "https://jobs.ashbyhq.com/vanta/fe5fd1a4-12ff-4703-bed5-6c2f34ba7768/application",
  "https://jobs.ashbyhq.com/runway-ml/44c1578a-3b0c-4b64-b1c0-89f51e8635ee/application",
];

function deriveCompanyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("ashbyhq.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "careers") return "Ashby";
      if (parts[0] && parts[0] !== "application") {
        return parts[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }
    }
  } catch (e) {}
  return "Ashby";
}

function deriveTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const jid = parsed.searchParams.get("ashby_jid");
    if (jid) return `Ashby Position (${jid.slice(0, 8)})`;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[1]) return `${deriveCompanyFromUrl(url)} Role (${parts[1].slice(0, 8)})`;
  } catch (e) {}
  return "Software Engineer / Product Role";
}

async function addJobsBatch() {
  console.log("📥 Adding batch of 11 job URLs to PostgreSQL database...\n");

  // Fetch all users
  const usersRes = await db.query("SELECT id, email FROM users");
  if (usersRes.rowCount === 0) {
    console.error("❌ No users found in database. Seed users first!");
    process.exit(1);
  }

  // Fetch active resumes for users
  const resumesRes = await db.query("SELECT user_id, id FROM resumes WHERE is_active = 1");
  const userResumeMap = new Map<string, string>();
  for (const row of resumesRes.rows) {
    userResumeMap.set(row.user_id, row.id);
  }

  let addedJobs = 0;
  let addedApps = 0;

  for (const url of JOB_URLS) {
    const ats = detectATSByUrl(url);
    const company = deriveCompanyFromUrl(url);
    const title = deriveTitleFromUrl(url);

    let jobId: string;
    const existingJob = await db.query("SELECT id FROM jobs WHERE url = $1", [url]);
    if (existingJob.rowCount > 0) {
      jobId = existingJob.rows[0].id;
      await db.query(
        `UPDATE jobs SET company = $1, title = $2, ats = $3, status = 'EXTRACTED' WHERE id = $4`,
        [company, title, ats, jobId]
      );
      console.log(`🔄 Updated existing Job [${company}]: ${url}`);
    } else {
      jobId = uuidv4();
      await db.query(
        `INSERT INTO jobs (id, url, company, title, description, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [jobId, url, company, title, "Ashby application link", ats, "EXTRACTED"]
      );
      console.log(`➕ Added new Job [${company}]: ${url}`);
      addedJobs++;
    }

    // Create applications for each user
    for (const user of usersRes.rows) {
      const resumeId = userResumeMap.get(user.id);
      if (!resumeId) continue;

      const existingApp = await db.query(
        "SELECT id FROM applications WHERE user_id = $1 AND job_id = $2",
        [user.id, jobId]
      );

      if (existingApp.rowCount === 0) {
        const appId = uuidv4();
        await db.query(
          `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [appId, user.id, jobId, resumeId, ats, "PENDING"]
        );
        addedApps++;
      }
    }
  }

  console.log(`\n🎉 Batch import complete! Added ${addedJobs} new jobs, created ${addedApps} application entries across ${usersRes.rowCount} users.`);
  await db.close();
  process.exit(0);
}

addJobsBatch().catch(async (err) => {
  console.error("❌ Batch import error:", err);
  await db.close();
  process.exit(1);
});
