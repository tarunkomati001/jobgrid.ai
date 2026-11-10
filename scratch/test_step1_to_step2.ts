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

  const emailInp = page.locator("[id='info.email']").first();
  console.log("email count:", await emailInp.count(), "visible:", await emailInp.isVisible());
  const curEmail = await emailInp.inputValue();
  console.log("curEmail:", curEmail);

  const phoneInp = page.locator("[id='info.cellPhone']").first();
  console.log("phone count:", await phoneInp.count(), "visible:", await phoneInp.isVisible());
  const curPhone = await phoneInp.inputValue();
  console.log("curPhone:", curPhone);

  // Now fill all required fields on Step 1
  await page.locator("[id='info.firstName']").fill(profile.firstName);
  await page.locator("[id='info.lastName']").fill(profile.lastName);
  await emailInp.fill(profile.email);
  await phoneInp.fill("2025550198");

  // Radio button
  const radio = page.locator("input[type='radio'][value*='LinkedIn']").first();
  if (await radio.count() > 0) await radio.check();

  // Click Next Step
  const nextBtn = page.locator("button:has-text('Next Step')").first();
  console.log("Clicking Next Step...");
  await nextBtn.click();
  await page.waitForTimeout(4000);

  console.log("Page title after click:", await page.title());
  const stepText = await page.locator("p:has-text('Step')").first().innerText().catch(() => "");
  console.log("Current step indicator:", stepText);

  // Take screenshot
  await page.screenshot({ path: "scratch/step2_reached.png", fullPage: true });

  // List all textareas and questions on Step 2
  const step2Questions = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("textarea, [class*='question'], label")).map(el => ({
      tagName: el.tagName,
      id: el.id,
      text: (el as HTMLElement).innerText?.trim()
    })).filter(x => x.text && x.text.length > 20);
  });
  console.log("STEP 2 QUESTIONS:", JSON.stringify(step2Questions.slice(0, 10), null, 2));

  await browser.close();
}

main();

