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

  const text = await page.evaluate(() => {
    const r1 = document.querySelector("input[name*='e15fa851']");
    let container = r1?.closest("div[data-testid='field']");
    let prevText = container?.parentElement?.previousElementSibling?.textContent || container?.previousElementSibling?.textContent || "";
    return {
      fieldOuter: container?.parentElement?.parentElement?.innerHTML?.slice(0, 800),
      prevText
    };
  });

  console.log("Radio 2 context:", text);
  await browser.close();
}

main().catch(console.error);
