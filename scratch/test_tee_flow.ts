import { chromium } from "playwright";
import { getUserProfile } from "../src/database/user-profile.service";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const profile = await getUserProfile("hrutin");

  console.log("Navigating to TTEC Taleo job...");
  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // 1. Privacy Agreement
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible().catch(() => false)) {
    console.log("Accepting Privacy Agreement...");
    await acceptBtn.click();
    await page.waitForTimeout(4000);
  }

  // 2. Guest Apply
  const guestBtn = page.locator("input[id*='guestapply'], input[value='Apply as Guest']").first();
  if (await guestBtn.isVisible().catch(() => false)) {
    console.log("Clicking Apply as Guest...");
    await guestBtn.click();
    await page.waitForTimeout(3000);
  }

  // 3. Guest Email
  const emailInp = page.locator("input[id*='email']").first();
  if (await emailInp.isVisible().catch(() => false)) {
    console.log("Filling Guest Email...");
    await emailInp.fill(profile.email);
    const contBtn = page.locator("input[id*='niceCommandButton_continue'], input[value='Continue']").first();
    await contBtn.click();
    await page.waitForTimeout(4000);
  }

  // 4. Attachments step
  console.log("Step title:", await page.title());
  const fileInp = page.locator("input[type='file']").first();
  if (await fileInp.isVisible().catch(() => false)) {
    console.log("Attaching resume...");
    await fileInp.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
    await page.waitForTimeout(1000);

    const attachBtn = page.locator("input[id*='attachFileCommand'], input[value='Attach']").first();
    if (await attachBtn.isVisible().catch(() => false)) {
      console.log("Clicking Attach button...");
      await attachBtn.click();
      await page.waitForTimeout(4000);
    }

    const saveCont = page.locator("input[id*='saveContinueCmd'], input[value='Save and Continue']").first();
    if (await saveCont.isVisible().catch(() => false)) {
      console.log("Clicking Save and Continue from Attachments...");
      await saveCont.click();
      await page.waitForTimeout(5000);
    }
  }

  console.log("Next Step URL:", page.url());
  console.log("Next Step Title:", await page.title());

  const stepInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea")).map(el => {
      const inp = el as any;
      return {
        tagName: el.tagName,
        id: el.id,
        name: inp.name,
        type: inp.type,
        label: (inp.labels && inp.labels[0]?.innerText) || el.closest("tr, td, div")?.querySelector("label, .label")?.innerText || ""
      };
    });
  });
  console.log("STEP INPUTS:", JSON.stringify(stepInputs.slice(0, 15), null, 2));

  await browser.close();
}

main();

