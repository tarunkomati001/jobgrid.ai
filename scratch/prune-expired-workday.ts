import { db } from '../src/database/db';
import { createBrowser } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(true);
  const page = await browser.newPage();

  const jobsRes = await db.query("SELECT id, url FROM jobs WHERE ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%'");
  console.log(`Checking ${jobsRes.rows.length} Workday jobs...`);

  for (const job of jobsRes.rows) {
    try {
      await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(3000);
      const title = await page.title();
      const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();

      // If page redirected to "Search for Jobs", the posting expired
      const isSearchPage = title.toLowerCase().includes("search for jobs") || text.includes("jobs found");
      const hasApplyBtn = await page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], [data-automation-id='autofillWithResume'], [data-automation-id='applyManually']").count() > 0;

      if (isSearchPage || (!job.url.includes("/apply") && !hasApplyBtn)) {
        console.log(`❌ Inactive/Expired Workday job: ${job.url}. Deleting from DB...`);
        await db.query("DELETE FROM jobs WHERE id = $1", [job.id]);
      } else {
        console.log(`✅ Valid Workday job with Apply button: ${job.url}`);
      }
    } catch (e: any) {
      console.log(`⚠️ Error on ${job.url}: ${e.message}`);
    }
  }

  await browser.close();
  await db.close();
}

main().catch(console.error);
