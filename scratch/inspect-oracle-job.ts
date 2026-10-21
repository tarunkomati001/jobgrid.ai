import { chromium } from "playwright";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log(`Navigating to ${URL}...`);
  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 });
  } catch (e: any) {
    console.log("Goto warning:", e.message);
  }

  await page.waitForTimeout(3000);

  const title = await page.title();
  const currentUrl = page.url();
  console.log("Page Title:", title);
  console.log("Current URL:", currentUrl);

  await page.screenshot({ path: "scratch/oracle_preview.png" });

  // Find buttons or apply links
  const buttons = await page.evaluate(() => {
    const clickable = Array.from(document.querySelectorAll("button, a"));
    return clickable
      .filter(el => {
        const text = el.textContent?.trim().toLowerCase() || "";
        return text.includes("apply") || text.includes("submit") || text.includes("sign in");
      })
      .map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        href: (el as HTMLAnchorElement).href || null,
        className: el.className,
        id: el.id
      }));
  });

  console.log("Apply / relevant elements:", JSON.stringify(buttons, null, 2));

  await browser.close();
}

main().catch(console.error);
