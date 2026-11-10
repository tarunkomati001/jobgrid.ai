import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();
  try {
    console.log("Navigating to Oracle Apply URL...");
    await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/347693/apply/email", { waitUntil: "domcontentloaded", timeout: 45000 });
    console.log("Loaded:", page.url());
    await page.waitForTimeout(5000);

    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("button, a[role='button'], input[type='button'], input[type='submit']")).map(b => ({
        tag: b.tagName,
        id: b.id,
        text: b.textContent?.trim().slice(0, 40),
        ariaLabel: b.getAttribute("aria-label"),
        type: b.getAttribute("type"),
        className: b.className,
        visible: (b as HTMLElement).offsetWidth > 0 && (b as HTMLElement).offsetHeight > 0
      }));
    });
    console.log("Buttons found on Oracle page:", JSON.stringify(buttons, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

main();

