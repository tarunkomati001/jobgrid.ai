import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://ats.rippling.com/en-GB/rippling/jobs/f255bf03-9173-4c0a-8a18-7cc43c27ded8";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const applyBtn = page.locator("button:has-text('Apply now')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(2000);
  }

  const aiOpt = await page.evaluate(() => {
    const el = document.querySelector("[data-testid='aiOptOut']");
    return {
      outer: el?.outerHTML,
      text: el?.closest("div[data-testid='field']")?.textContent || el?.parentElement?.textContent
    };
  });

  console.log("aiOptOut:", aiOpt);
  await browser.close();
}

main().catch(console.error);
