import { db } from '../src/database/db';
import { createBrowser } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(true); // headless check
  const page = await browser.newPage();

  const jobsRes = await db.query("SELECT id, url FROM jobs WHERE ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%'");
  console.log(`Checking ${jobsRes.rows.length} Workday jobs...`);

  for (const job of jobsRes.rows) {
    try {
      const resp = await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 20000 });
      const status = resp?.status() || 0;
      const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      const isExpired = status === 404 || text.includes("job no longer available") || text.includes("this position has been filled") || text.includes("not found");

      if (isExpired) {
        console.log(`❌ Expired job: ${job.url}. Deleting from DB...`);
        await db.query("DELETE FROM jobs WHERE id = $1", [job.id]);
      } else {
        console.log(`✅ Active job: ${job.url}`);
      }
    } catch (e: any) {
      console.log(`⚠️ Error checking ${job.url}: ${e.message}`);
    }
  }

  await browser.close();
  await db.close();
}

main().catch(console.error);
