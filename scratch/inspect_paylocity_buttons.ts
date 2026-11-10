import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit'], [role='button'], [class*='btn'], [class*='Button']")).map(b => ({
      tag: b.tagName,
      id: b.id,
      className: b.className,
      text: (b.textContent || (b as any).value || "").trim().slice(0, 50),
      type: b.getAttribute("type"),
      disabled: (b as any).disabled || b.getAttribute("aria-disabled")
    })).filter(b => b.text.toLowerCase().includes("next") || b.text.toLowerCase().includes("apply") || b.text.toLowerCase().includes("submit") || b.text.toLowerCase().includes("step"));
  });
  console.log("Filtered buttons on page:", JSON.stringify(buttons, null, 2));
  await browser.close();
}

main().catch(console.error);
