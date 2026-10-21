import { db } from "../src/database/db";
import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const TARGET_URLS = [
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4720",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4812",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4679"
];

async function addJobsToDatabase(jobDetailsList: Array<{ url: string; company: string; title: string; description: string; ats: string }>) {
  console.log("💾 Adding jobs to PostgreSQL database...");

  // Fetch all users
  const usersRes = await db.query("SELECT id, email FROM users");
  console.log(`Found ${usersRes.rowCount} users in DB.`);

  // Fetch active resumes
  const resumesRes = await db.query("SELECT user_id, id FROM resumes WHERE is_active = 1");
  const userResumeMap = new Map<string, string>();
  for (const row of resumesRes.rows) {
    userResumeMap.set(row.user_id, row.id);
  }

  for (const job of jobDetailsList) {
    let jobId: string;
    const existing = await db.query("SELECT id FROM jobs WHERE url = $1", [job.url]);
    if (existing.rowCount && existing.rowCount > 0) {
      jobId = existing.rows[0].id;
      await db.query(
        "UPDATE jobs SET company = $1, title = $2, description = $3, ats = $4, status = 'EXTRACTED' WHERE id = $5",
        [job.company, job.title, job.description, job.ats, jobId]
      );
      console.log(`🔄 Updated existing job in DB: [${job.company}] ${job.title} (ID: ${jobId})`);
    } else {
      jobId = uuidv4();
      await db.query(
        "INSERT INTO jobs (id, url, company, title, description, ats, status) VALUES ($1, $2, $3, $4, $5, $6, 'EXTRACTED')",
        [jobId, job.url, job.company, job.title, job.description, job.ats]
      );
      console.log(`➕ Added new job to DB: [${job.company}] ${job.title} (ID: ${jobId})`);
    }

    // Insert or update applications
    for (const u of usersRes.rows) {
      const resumeId = userResumeMap.get(u.id);
      if (!resumeId) continue;

      const existingApp = await db.query("SELECT id FROM applications WHERE user_id = $1 AND job_id = $2", [u.id, jobId]);
      if (existingApp.rowCount && existingApp.rowCount > 0) {
        console.log(`   Application already exists for user ${u.email}`);
      } else {
        const appId = uuidv4();
        await db.query(
          "INSERT INTO applications (id, user_id, job_id, resume_id, ats, status) VALUES ($1, $2, $3, $4, $5, 'PENDING')",
          [appId, u.id, jobId, resumeId, job.ats]
        );
        console.log(`   ➕ Created application for user ${u.email} (App ID: ${appId})`);
      }
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const adapter = new TaleoAdapter();

  const extractedList: Array<{ url: string; company: string; title: string; description: string; ats: string }> = [];

  for (const url of TARGET_URLS) {
    console.log(`\n🔍 Fetching job page: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    const details = await adapter.extractJob(page);
    console.log(`   Title: ${details.title}`);
    console.log(`   Company: ${details.company}`);
    console.log(`   Desc length: ${details.description.length}`);

    extractedList.push({
      url,
      company: details.company || "Base Solutions",
      title: details.title || "Taleo Requisition",
      description: details.description || "",
      ats: "TALEO"
    });
  }

  await browser.close();

  // Add all to database
  await addJobsToDatabase(extractedList);

  await db.close();
  console.log("\n✅ Job extraction & DB insertion completed successfully.");
}

main().catch(async (e) => {
  console.error("Error:", e);
  await db.close();
});
