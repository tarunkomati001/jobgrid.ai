import { chromium } from "playwright";

const URLS = [
  "https://ats.rippling.com/en-GB/rippling/jobs/f255bf03-9173-4c0a-8a18-7cc43c27ded8",
  "https://ats.rippling.com/en-GB/rippling/jobs/8ef65aa0-ede3-45cb-814f-3631c25597cf",
  "https://ats.rippling.com/en-GB/rippling/jobs/98b559a6-c8b2-4ede-85d9-cbf4883da996",
  "https://ats.rippling.com/en-GB/rippling/jobs/6a055998-1560-4e2b-b0eb-79913c5d49f1"
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`\n======================================================`);
    console.log(`[${i + 1}/${URLS.length}] Inspecting: ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(2000);

      const title = await page.title();
      const h1 = await page.locator("h1").innerText().catch(() => "");
      console.log(`Title: ${title} | H1: ${h1}`);

      // Check if Apply button exists or form is visible
      const hasApply = await page.locator("button:has-text('Apply now'), button:has-text('Apply'), [data-testid='apply-button']").count();
      const hasFirstName = await page.locator("input[data-testid='input-first_name']").count();
      console.log(`hasApply: ${hasApply}, hasFirstName: ${hasFirstName}`);

      if (hasApply > 0 && hasFirstName === 0) {
        console.log("Clicking Apply now...");
        await page.locator("button:has-text('Apply now'), button:has-text('Apply'), [data-testid='apply-button']").first().click();
        await page.waitForTimeout(2000);
      }

      const fields = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll("div[data-testid='field']"));
        return els.map(el => {
          const label = el.querySelector("label, span[id$='-label'], [class*='label']")?.textContent || "";
          const input = el.querySelector("input, textarea, div[role='combobox']");
          const testId = input?.getAttribute("data-testid") || el.getAttribute("data-testid") || "";
          return { label: label.trim().replace(/\s+/g, " "), testId };
        });
      });

      console.log(`Found ${fields.length} fields:`);
      fields.forEach(f => console.log(` - [${f.testId}]: "${f.label}"`));
    } catch (e: any) {
      console.error(`Error loading ${url}:`, e.message);
    }
  }

  await browser.close();
}

main().catch(console.error);
