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
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept'), a:has-text('I Accept')").first();
  if (await acceptBtn.isVisible().catch(() => false)) {
    console.log("[Taleo] Accepting Privacy Agreement...");
    await acceptBtn.click();
    await page.waitForTimeout(3000);
  }

  // 2. Login / Register
  const isLoginPage = page.url().includes("accessmanagement") || page.url().includes("login.jsf") || (await page.locator("input[id*='userName'], input[id*='login-name1']").count()) > 0;
  if (isLoginPage) {
    console.log("[Taleo] On Login / Auth screen...");
    const guestBtn = page.locator("input[id*='guestapply'], input[value='Apply as Guest']").first();
    if (await guestBtn.isVisible().catch(() => false)) {
      console.log("[Taleo] Clicking 'Apply as Guest'...");
      await guestBtn.click();
      await page.waitForTimeout(3000);
      const emailInput = page.locator("input[id*='email']").first();
      if (await emailInput.isVisible().catch(() => false)) {
        await emailInput.fill(profile.email);
        const cont = page.locator("input[id*='niceCommandButton_continue'], input[value='Continue']").first();
        await cont.click();
        await page.waitForTimeout(4000);
      }
    } else {
      console.log("[Taleo] Filling login credentials...");
      await page.fill("input[id*='name1'], input[id*='userName']", profile.email).catch(() => {});
      await page.fill("input[id*='password']", "Tarun@2006").catch(() => {});
      const loginBtn = page.locator("input[id*='defaultCmd'], input[value='Login']").first();
      await loginBtn.click();
      await page.waitForTimeout(4000);
    }
  }

  // Multi-step form loop
  for (let s = 1; s <= 6; s++) {
    console.log(`\n[Taleo Step ${s}] URL: ${page.url()}`);
    console.log(`[Taleo Step ${s}] Title: ${await page.title()}`);

    // If file input present (Upload Attachments)
    const fileInp = page.locator("input[type='file']").first();
    if (await fileInp.isVisible().catch(() => false)) {
      console.log("[Taleo] Attaching resume...");
      await fileInp.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf").catch(() => {});
      await page.waitForTimeout(1000);
      const attachBtn = page.locator("input[id*='attachFileCommand'], input[value='Attach']").first();
      if (await attachBtn.isVisible().catch(() => false)) {
        await attachBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    // Dynamic field population
    const textInputs = page.locator("input[type='text']:visible, input[type='email']:visible, input[type='tel']:visible");
    const count = await textInputs.count();
    for (let i = 0; i < count; i++) {
      const inp = textInputs.nth(i);
      const id = (await inp.getAttribute("id") || "").toLowerCase();
      const val = await inp.inputValue().catch(() => "");
      if (val) continue;

      if (id.includes("first")) await inp.fill(profile.firstName);
      else if (id.includes("last")) await inp.fill(profile.lastName);
      else if (id.includes("middle")) await inp.fill(profile.middleName || "");
      else if (id.includes("email")) await inp.fill(profile.email);
      else if (id.includes("phone") || id.includes("cell")) await inp.fill(profile.phone ? profile.phone.replace(/\D/g, "").slice(-10) : "2025550198");
      else if (id.includes("address") || id.includes("street")) await inp.fill(profile.street || "123 Market St");
      else if (id.includes("city")) await inp.fill(profile.city || "San Francisco");
      else if (id.includes("zip") || id.includes("postal")) await inp.fill(profile.zipCode || "94105");
    }

    // Selects
    const selects = page.locator("select:visible");
    const selCount = await selects.count();
    for (let j = 0; j < selCount; j++) {
      const sel = selects.nth(j);
      const id = (await sel.getAttribute("id") || "").toLowerCase();
      if (id.includes("country")) {
        await sel.selectOption({ label: "United States" }).catch(async () => {
          await sel.selectOption("1").catch(() => {});
        });
      } else if (id.includes("state")) {
        await sel.selectOption({ label: profile.state || "California" }).catch(() => {});
      } else if (id.includes("gender")) {
        await sel.selectOption({ label: "Male" }).catch(() => {});
      } else if (id.includes("race") || id.includes("ethnic")) {
        await sel.selectOption({ label: "Asian" }).catch(() => {});
      }
    }

    // Advance
    const saveCont = page.locator("input[id*='saveContinueCmd'], input[value='Save and Continue'], input[value='Next'], button:has-text('Save and Continue')").first();
    if (await saveCont.isVisible().catch(() => false)) {
      console.log("[Taleo] Advancing with Save and Continue...");
      await saveCont.click();
      await page.waitForTimeout(4000);
    } else {
      console.log("[Taleo] No Save and Continue button found. Checking submit or review...");
      break;
    }
  }

  await browser.close();
}

main();

