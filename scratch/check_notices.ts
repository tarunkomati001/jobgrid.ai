import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  await page.goto("https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // 1. Upload Resume
  const fileInput = page.locator("input[type='file']").first();
  await fileInput.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.waitForTimeout(2000);

  // 2. Click Next Step
  const nextBtn = page.locator("button:has-text('Next Step')").first();
  await nextBtn.click();
  await page.waitForTimeout(2000);

  // Find all validation messages
  const notices = await page.evaluate(() => {
    const list: string[] = [];
    document.querySelectorAll("*").forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.color.includes("220") || style.color.includes("255, 0") || style.color === "red" || (el as HTMLElement).innerText?.includes("Required")) {
        const text = (el as HTMLElement).innerText?.trim();
        if (text && text.length < 100 && !list.includes(text)) {
          list.push(text);
        }
      }
    });
    return list;
  });
  console.log("NOTICES ON SCREEN:", notices);

  await browser.close();
}

main();

