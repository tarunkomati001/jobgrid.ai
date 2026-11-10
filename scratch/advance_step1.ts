import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { getUserProfile } from "../src/database/user-profile.service";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  const profile = await getUserProfile("hrutin");
  await page.goto("https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // 1. Upload Resume
  const fileInput = page.locator("input[type='file']").first();
  await fileInput.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.waitForTimeout(1000);

  // 2. Uncheck auto-parse
  const parseCheckbox = page.locator("input#useAttachedResumeToFillOutApplication");
  if (await parseCheckbox.count() > 0) {
    await parseCheckbox.evaluate((el: HTMLInputElement) => { el.checked = false; el.dispatchEvent(new Event("change", { bubbles: true })); });
  }

  // 3. Contact info
  await page.locator("[id='info.firstName']").fill(profile.firstName);
  await page.locator("[id='info.lastName']").fill(profile.lastName);
  await page.locator("[id='info.email']").fill(profile.email);
  await page.locator("[id='info.cellPhone']").fill("2025550198");

  // 4. SMS Dropdown
  const sms = page.locator("div[id='info.smsOptedIn'], [data-for*='sms']").first();
  if (await sms.count() > 0) {
    await sms.click();
    await page.waitForTimeout(300);
    const yesOpt = page.locator("li:has-text('Yes'), div:has-text('Yes')").first();
    if (await yesOpt.count() > 0) await yesOpt.click();
  }

  // 5. Radio button
  const radio = page.locator("input[type='radio'][value*='LinkedIn']").first();
  if (await radio.count() > 0) await radio.check();

  // Click Next Step
  const nextBtn = page.locator("button:has-text('Next Step')").first();
  console.log("Clicking Next Step...");
  await nextBtn.click();
  await page.waitForTimeout(4000);

  const stepText = await page.locator("p:has-text('Step')").first().innerText().catch(() => "");
  console.log("Current step indicator:", stepText);

  // Take screenshot
  await page.screenshot({ path: "scratch/step2_real.png", fullPage: true });

  // List all textareas and questions on Step 2
  const textareas = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("textarea")).map(el => {
      const parent = el.closest(".form-group, div[class*='question'], div[class*='group'], div");
      return {
        id: el.id,
        name: el.name,
        placeholder: el.placeholder,
        label: (el as any).labels?.[0]?.innerText || parent?.querySelector("label, p, span")?.innerText || ""
      };
    });
  });
  console.log("STEP 2 TEXTAREAS:", JSON.stringify(textareas, null, 2));

  await browser.close();
}

main();

