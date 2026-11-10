import { chromium } from "playwright";
import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function diagnose() {
  const context = await createPersistentBrowserContext(true); // headless for fast inspection
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log("Navigating to https://wellfound.com/join...");
  await page.goto("https://wellfound.com/join", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const url = page.url();
  const title = await page.title();
  console.log(`URL: ${url}`);
  console.log(`Title: ${title}`);

  // Dump all inputs and buttons on this page
  const elements = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, button, a")).map(el => {
      const tag = el.tagName.toLowerCase();
      const text = el.textContent?.trim().slice(0, 50) || "";
      const type = el.getAttribute("type") || "";
      const name = el.getAttribute("name") || "";
      const id = el.id || "";
      const placeholder = el.getAttribute("placeholder") || "";
      const href = el.getAttribute("href") || "";
      return { tag, text, type, name, id, placeholder, href };
    });
    return inputs.filter(i => i.text || i.placeholder || i.name || i.id || (i.tag === 'a' && i.href.includes('join')));
  });

  console.log("Interactive elements:", JSON.stringify(elements, null, 2));
  await page.screenshot({ path: "scratch/diagnose_join_page.png" });
  await context.close();
}

diagnose().catch(console.error);

