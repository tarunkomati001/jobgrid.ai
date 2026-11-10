import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import path from "path";

async function checkResumeParsing() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  const fileInput = page.locator("input#btn-resume, input[type='file'][id*='resume'], input[type='file']").first();
  await fileInput.setInputFiles(resumePath);
  console.log("Uploaded resume, waiting 5 seconds for parse...");
  await page.waitForTimeout(5000);

  const values = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea")).map((el: any) => ({
      id: el.id,
      name: el.name,
      value: el.value
    })).filter(x => x.value && x.value.trim().length > 0);
  });

  console.log("Values populated by Paylocity resume parser:\n", JSON.stringify(values, null, 2));

  await browser.close();
}

checkResumeParsing().catch(console.error);
