import { chromium } from "playwright";

async function inspect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://bloomberg.avature.net/careers/ApplicationMethods?jobId=20217", { waitUntil: "networkidle" });

  const formsAndFiles = await page.evaluate(() => {
    return {
      forms: Array.from(document.querySelectorAll("form")).map(f => ({
        id: f.id,
        action: f.action,
        method: f.method,
        html: f.outerHTML.slice(0, 300)
      })),
      fileInputs: Array.from(document.querySelectorAll("input[type='file']")).map(inp => ({
        id: inp.id,
        name: inp.name,
        accept: inp.accept,
        outerHTML: inp.outerHTML
      })),
      scripts: Array.from(document.querySelectorAll("script")).map(s => s.src || s.textContent?.slice(0, 100)).filter(Boolean)
    };
  });

  console.log("Forms and files:", JSON.stringify(formsAndFiles, null, 2));
  await browser.close();
}

inspect().catch(console.error);

