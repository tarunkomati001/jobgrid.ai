import { chromium } from "playwright";

async function inspectButtons() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const btnDetails = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button"))
      .filter(b => b.textContent?.includes("Agree"))
      .map(b => ({
        text: b.textContent,
        innerText: b.innerText,
        html: b.outerHTML
      }));
  });
  console.log("Btn details:", JSON.stringify(btnDetails, null, 2));

  await browser.close();
}

inspectButtons().catch(console.error);
