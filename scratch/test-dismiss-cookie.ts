import { chromium } from "playwright";

async function testDismiss() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const foundText = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("h1, h2, h3, h4, div, p"))
      .filter(el => el.textContent?.includes("Cookies agreement"))
      .map(el => ({ tag: el.tagName, text: el.textContent?.slice(0, 50), html: el.outerHTML.slice(0, 150) }));
  });
  console.log("Found text elements:", foundText);

  // Check buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button"))
      .map(b => b.textContent?.trim())
      .filter(t => t && (t.includes("Agree") || t.includes("Accept") || t.includes("cookie")));
  });
  console.log("Found buttons:", buttons);

  await browser.close();
}

testDismiss().catch(console.error);
