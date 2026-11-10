import { chromium } from "playwright";
import { db } from "../src/database/db";

async function searchJobs() {
  const jobs = await db.query("SELECT * FROM jobs WHERE ats = 'JOBVITE' OR url LIKE '%jobvite%'");
  console.log(`Checking ${jobs.rows.length} Jobvite jobs...`);

  const browser = await chromium.launch({ headless: true });

  for (const job of jobs.rows) {
    const page = await browser.newPage();
    try {
      let applyUrl = job.url;
      if (!applyUrl.includes('/apply')) applyUrl = applyUrl.replace(/\/+$/, '') + '/apply';
      await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      const content = await page.content();
      if (content.toLowerCase().includes("applicant screening questions") || content.toLowerCase().includes("require sponsorship for employment visa")) {
        console.log(`🎯 MATCH FOUND! Job: ${job.title} | URL: ${job.url}`);
      }
    } catch (e) {
      // ignore timeout
    } finally {
      await page.close();
    }
  }

  await browser.close();
  process.exit(0);
}

searchJobs();

