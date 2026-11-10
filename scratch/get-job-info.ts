import { createPersistentBrowserContext } from "../src/browser/browser-manager";
import { WellfoundAdapter } from "../src/ats/wellfound/wellfound.adapter";

async function getJob() {
  const context = await createPersistentBrowserContext(true);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  const url = "https://wellfound.com/jobs/3293991-founding-software-engineer";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

  const adapter = new WellfoundAdapter();
  const job = await adapter.extractJob(page);
  console.log("Job:", JSON.stringify(job, null, 2));
  await context.close();
}

getJob().catch(console.error);

