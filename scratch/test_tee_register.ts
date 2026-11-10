import { chromium } from "playwright";
import { getUserProfile } from "../src/database/user-profile.service";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const profile = await getUserProfile("hrutin");

  console.log("Navigating to TTEC Taleo job...");
  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // 1. Accept Privacy
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton']").first();
  if (await acceptBtn.isVisible()) {
    console.log("Accepting Privacy Agreement...");
    await acceptBtn.click();
    await page.waitForTimeout(3000);
  }

  // 2. Click New User
  const newUserBtn = page.locator("input[value='New User'], input[id*='register']").first();
  if (await newUserBtn.isVisible()) {
    console.log("Clicking New User...");
    await newUserBtn.click();
    await page.waitForTimeout(3000);
  }

  // 3. Fill New User Registration
  const uname = `hrutin_${Date.now().toString().slice(-4)}`;
  const pw = "ClucoPass@2026!Secure";
  console.log(`Registering new candidate on Taleo: ${uname} / ${profile.email}...`);

  await page.fill("input[id*='userName']", uname);
  await page.fill("input[id*='password']:not([id*='Confirm'])", pw);
  await page.fill("input[id*='passwordConfirm']", pw);
  await page.fill("input[id*='email']", profile.email);

  const regSubmit = page.locator("input[id*='defaultCmd'], input[value='Register']").first();
  await regSubmit.click();
  await page.waitForTimeout(5000);

  console.log("URL after register:", page.url());
  console.log("Title after register:", await page.title());

  const fields = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea")).map(el => {
      const inp = el as any;
      return {
        id: el.id,
        name: inp.name,
        type: inp.type,
        label: (inp.labels && inp.labels[0]?.innerText) || el.closest("tr, td, div")?.querySelector("label, .label")?.innerText || ""
      };
    });
  });
  console.log("FIELDS ON STEP 1 OF APPLICATION:", JSON.stringify(fields.slice(0, 15), null, 2));

  await browser.close();
}

main();

