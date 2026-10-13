import { chromium } from "playwright";

async function main() {
  const url = "https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application";
  console.log("🔍 Debugging Location DOM structure...");
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    
    // Find labels matching "Location"
    const labels = await page.$$("label");
    for (const label of labels) {
      const text = await label.innerText();
      if (text.includes("Location")) {
        console.log(`\n🏷️ Label Text: "${text}"`);
        const htmlFor = await label.getAttribute("for");
        console.log(`👉 htmlFor: "${htmlFor}"`);
        
        // Dump parent HTML
        const parentHtml = await label.evaluate(el => el.parentElement?.innerHTML);
        console.log(`📦 Parent Element HTML Snippet:\n${parentHtml?.substring(0, 1000)}`);
      }
    }
  } catch (error) {
    console.error("Debug failed:", error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
