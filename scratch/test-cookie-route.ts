import { chromium } from "playwright";

async function testRoute() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const btnDetails = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button"))
      .filter(b => b.textContent?.includes("Agree"))
      .map(b => ({
        text: b.textContent,
        html: b.outerHTML
      }));
  });
  console.log("Btn details on /c/new:", JSON.stringify(btnDetails, null, 2));

  await browser.close();
}

testRoute().catch(console.error);
