import { chromium } from "playwright";

async function main() {
  const url = "https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application";
  console.log("🔍 Scraping all labels on Ashby form...");
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    
    console.log("\n--- Labels in DOM ---");
    const labels = await page.$$("label");
    for (const label of labels) {
      const text = await label.innerText();
      const htmlFor = await label.getAttribute("for");
      const tagName = await label.evaluate(el => el.tagName.toLowerCase());
      console.log(`- Text: "${text.trim().replace(/\n/g, ' ')}" | htmlFor: "${htmlFor}"`);
    }
  } catch (error) {
    console.error("Debug failed:", error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
