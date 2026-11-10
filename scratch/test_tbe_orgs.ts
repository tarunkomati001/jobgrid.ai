import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const orgs = ["GATEWAYVENT", "MAXIMUS", "AMERITA", "KBR"];
  for (const o of orgs) {
    const u = `https://chm.tbe.taleo.net/chm01/ats/careers/v2/jobSearch?org=${o}&cws=1`;
    try {
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(2000);
      const title = await page.title();
      const count = await page.locator("a[href*='viewRequisition']").count();
      console.log(`org=${o}: title="${title}", open jobs count: ${count}`);
      if (count > 0) {
        const first = await page.locator("a[href*='viewRequisition']").first().getAttribute("href");
        console.log(` -> Active job URL: ${first}`);
      }
    } catch (e: any) {
      console.log(`org=${o} failed: ${e.message}`);
    }
  }

  await browser.close();
}

main();

