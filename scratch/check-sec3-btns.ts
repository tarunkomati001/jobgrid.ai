import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/section/3";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" }).catch(() => {});
  
  // Dump how Yes/No buttons and Submit button appear in DOM
  const check = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button")).map((b: any) => ({
      text: b.textContent?.trim(),
      type: b.type,
      classes: b.className,
      id: b.id,
      parentTag: b.parentElement?.tagName,
      parentClass: b.parentElement?.className,
      grandParentClass: b.parentElement?.parentElement?.className
    }));
    return btns;
  });
  console.log("Buttons on Section 3:", JSON.stringify(check, null, 2));
  await browser.close();
}

main().catch(console.error);
