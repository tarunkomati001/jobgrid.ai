import { db } from "../src/database/db";
import { v4 as uuidv4 } from "uuid";
import { detectATSByUrl } from "../src/ats/ats-detector";

const NEW_JOB_URLS = [
  "https://jobs.ashbyhq.com/notion/6895adad-5031-4dce-9e8e-b9361d3a2850",
  "https://jobs.ashbyhq.com/notion/d177d052-ef57-4900-acf2-d58e9eded620",
  "https://jobs.ashbyhq.com/notion/a9d4a192-d31c-48d2-8156-e2a75d98eec1",
  "https://jobs.ashbyhq.com/runway-ml/44c1578a-3b0c-4b64-b1c0-89f51e8635ee",
  "https://jobs.ashbyhq.com/ramp/198150d6-789a-4ef8-999f-93a49656d4f1",
  "https://jobs.ashbyhq.com/ramp/4e64ab86-4e30-403b-b1b9-41dc052570ce",
  "https://jobs.ashbyhq.com/ramp/bca0346c-b843-4795-96df-6091f51e421b",
  "https://jobs.ashbyhq.com/linear/cd5ae036-0223-427a-b038-ba16ef9dcb32",
  "https://jobs.ashbyhq.com/Linear/0c7c2e26-0a98-42cf-a47c-9a3999fb513b",
  "https://jobs.ashbyhq.com/linear/ba8a41d2-4198-481a-a7f4-e09c5364ff7f",
  "https://jobs.ashbyhq.com/linear/eac7f181-d658-4943-9430-51bae2bcd110"
];

function deriveCompanyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] && parts[0] !== "application") {
      return parts[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
  } catch (e) {}
  return "Ashby";
}

function deriveTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const company = deriveCompanyFromUrl(url);
    const jid = parts[1] || "role";
    return `${company} Role (${jid.slice(0, 8)})`;
  } catch (e) {}
  return "Software Engineer / Product Role";
}

async function updateJobLinks() {
  console.log("🧹 Replacing existing job database entries with new 11 job links...\n");

  // 1. Delete previous job applications and jobs (except test-job if present)
  await db.query("DELETE FROM applications");
  console.log("🗑️  Cleared existing application records.");
  
  await db.query("DELETE FROM jobs WHERE url != 'https://ashbyhq.com/test-job'");
  console.log("🗑️  Cleared existing job records.");

  // 2. Fetch all users
  const usersRes = await db.query("SELECT id, email FROM users ORDER BY id ASC");
  console.log(`👤 Found ${usersRes.rowCount} user(s) in database.`);

  // 3. Fetch active resumes for users
  const resumesRes = await db.query("SELECT user_id, id FROM resumes WHERE is_active = 1");
  const userResumeMap = new Map<string, string>();
  for (const row of resumesRes.rows) {
    userResumeMap.set(row.user_id, row.id);
  }

  let addedJobs = 0;
  let addedApps = 0;

  for (let i = 0; i < NEW_JOB_URLS.length; i++) {
    const url = NEW_JOB_URLS[i];
    const ats = detectATSByUrl(url);
    const company = deriveCompanyFromUrl(url);
    const title = deriveTitleFromUrl(url);
    const jobId = uuidv4();

    await db.query(
      `INSERT INTO jobs (id, url, company, title, description, ats, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [jobId, url, company, title, `${company} application position`, ats, "EXTRACTED"]
    );
    console.log(`➕ [${i + 1}/11] Added Job [${company}]: ${url}`);
    addedJobs++;

    for (const user of usersRes.rows) {
      const resumeId = userResumeMap.get(user.id);
      const appId = uuidv4();
      await db.query(
        `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [appId, user.id, jobId, resumeId || null, ats, "PENDING"]
      );
      addedApps++;
    }
  }

  console.log(`\n🎉 Job list update complete! Added ${addedJobs} new jobs, created ${addedApps} application entries.`);
  await db.close();
}

updateJobLinks().catch(async (err) => {
  console.error("❌ Error updating jobs:", err);
  await db.close();
  process.exit(1);
});
