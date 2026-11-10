import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { getUserProfile } from "../src/database/user-profile.service";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const profile = await getUserProfile("hrutin");
  const adapter = new TaleoAdapter();

  console.log("Testing TaleoAdapter on Daimler job: https://tas-daimler.taleo.net/careersection/ex/jobapply.ftl?job=MER00045QI&lang=en...");
  await page.goto("https://tas-daimler.taleo.net/careersection/ex/jobapply.ftl?job=MER00045QI&lang=en", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const isTaleo = await adapter.detect(page);
  console.log("Detected Taleo:", isTaleo);

  const job = await adapter.extractJob(page);
  console.log("Extracted Job:", job);

  await adapter.fillForm(page, profile);
  console.log("Completed fillForm for Taleo!");

  await page.screenshot({ path: "scratch/taleo_filled_step.png", fullPage: true });
  console.log("Saved scratch/taleo_filled_step.png");

  await browser.close();
}

main().catch(err => {
  console.error("Error in Taleo test:", err);
  process.exit(1);
});

