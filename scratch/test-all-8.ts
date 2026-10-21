import { chromium } from "playwright";

const URLS = [
  "https://jobs.emergentsoftware.net/o/account-manager-ecommerce",
  "https://jobs.emergentsoftware.net/o/solutions-engineer-optical-metrology",
  "https://jobs.emergentsoftware.net/o/accounts-receivable-specialist",
  "https://jobs.emergentsoftware.net/o/technical-product-owner-data",
  "https://jobs.emergentsoftware.net/o/embedded-software-engineer",
  "https://jobs.emergentsoftware.net/o/ai-architect",
  "https://careers.techwolf.ai/o/ai-engineering-lead/c/new",
  "https://careers.techwolf.ai/o/internship-software-engineer/c/new"
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (let i = 0; i < URLS.length; i++) {
    const rawUrl = URLS[i];
    const url = rawUrl.endsWith("/c/new") ? rawUrl : `${rawUrl}/c/new`;
    console.log(`\n======================================================`);
    console.log(`[${i + 1}/${URLS.length}] Checking: ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(1500);

      const title = await page.title();
      const h1 = await page.locator("h1").innerText().catch(() => "");
      console.log(`Title: ${title} | H1: ${h1}`);

      // Count inputs
      const counts = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"));
        return {
          total: inputs.length,
          types: inputs.map(el => (el as HTMLInputElement).type || el.tagName.toLowerCase())
        };
      });
      console.log(`Inputs found: ${counts.total}`);
    } catch (e: any) {
      console.error(`Error loading ${url}:`, e.message);
    }
  }

  await browser.close();
}

main().catch(console.error);
