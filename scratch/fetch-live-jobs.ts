import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://wellfound.com/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  
  await page.locator("input#user_email, input[type='email']").first().fill("tharunkomite7@gmail.com");
  await page.locator("input#user_password, input[type='password']").first().fill("TharunDev@2024!");
  await page.locator("input[type='submit'][value*='Log in' i], button[type='submit']").first().click();
  await page.waitForTimeout(4000);
  
  await page.goto("https://wellfound.com/jobs", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  
  // Close any feature modal
  const closeBtn = page.locator("button:has-text('Skip for now'), button:has-text('Close')").first();
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  const jobLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href*='/jobs/']"));
    const map = new Map();
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const match = href.match(/\/jobs\/(\d+-[a-z0-9-]+)/i);
      if (match) {
        const fullUrl = "https://wellfound.com" + match[0];
        const title = a.textContent?.trim() || "Software Engineer";
        if (!map.has(fullUrl)) {
          map.set(fullUrl, title);
        }
      }
    }
    return Array.from(map.entries()).map(([url, title]) => ({ url, title }));
  });

  console.log("Found jobs:", JSON.stringify(jobLinks.slice(0, 8), null, 2));
  await browser.close();
}

main().catch(console.error);

