import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const rids = [4720, 4812, 4937, 4679, 4500, 5000, 5100, 5200];
  for (const r of rids) {
    const u = `https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=${r}`;
    await page.goto(u, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const title = await page.title();
    const hasApply = await page.locator("a:has-text('Apply Now'), button:has-text('Apply Now')").count();
    console.log(`rid=${r}: ${title} (Apply: ${hasApply > 0})`);
    if (hasApply > 0) {
      console.log(` -> FOUND ACTIVE JOB: ${u}`);
      break;
    }
  }

  await browser.close();
}

main();

