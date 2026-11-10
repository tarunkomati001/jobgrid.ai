import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  await page.goto("https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const btnHtml = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, input[type='submit']"));
    return btns.map(b => ({
      tagName: b.tagName,
      id: b.id,
      className: b.className,
      text: (b as HTMLElement).innerText?.trim(),
      outerHTML: b.outerHTML
    }));
  });
  console.log("BUTTONS:", JSON.stringify(btnHtml, null, 2));

  await browser.close();
}

main();

