import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";

async function main() {
  const activeUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Software-Developer_R18300-1";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto(activeUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(4000);

  const applyManually = page.locator("a[data-automation-id='applyManually'], button[data-automation-id='applyManually'], [role='button']:has-text('Apply Manually')").first();
  if (await applyManually.count() > 0 && await applyManually.isVisible()) {
    await applyManually.click({ force: true });
  }

  await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName']", { timeout: 20000 });
  await page.waitForTimeout(2000);

  const testEmail = `babufakemail+clario${Date.now()}@gmail.com`;
  const testPw = "Tarun@2026!Aa";

  const hasVerifyPw = (await page.locator("input[data-automation-id='verifyPassword']").count()) > 0;
  if (!hasVerifyPw) {
    const createLink = page.locator("button[data-automation-id='createAccountLink'], a[data-automation-id='createAccountLink'], button:has-text('Create Account')").first();
    if (await createLink.count() > 0) {
      await createLink.click({ force: true });
      await page.waitForSelector("input[data-automation-id='verifyPassword']", { timeout: 10000 });
      await page.waitForTimeout(1000);
    }
  }

  await page.locator("input[data-automation-id='email']").first().fill(testEmail);
  await page.locator("input[data-automation-id='password']").first().fill(testPw);
  await page.locator("input[data-automation-id='verifyPassword']").first().fill(testPw);

  const cb = page.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox'], input[type='checkbox']").first();
  if (await cb.count() > 0 && !await cb.isChecked()) {
    await cb.check({ force: true });
  }

  const createBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Create Account'], button[data-automation-id='createAccountSubmitButton']").first();
  await createBtn.click({ force: true });
  await page.waitForTimeout(10000);

  const adapter = new WorkdayAdapter();
  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: testEmail,
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    street: "1/908 aaradhya",
    addressLine2: "limda",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390001",
    country: "India",
    willingToRelocate: true,
    workAuthorization: "Yes",
    yearsOfExperience: 2,
    gender: "Male"
  };

  // Close drawer
  const closeDrawer = page.locator("button[aria-label='Close'], button:has-text('✕')").first();
  if (await closeDrawer.count() > 0 && await closeDrawer.isVisible().catch(() => false)) {
    await closeDrawer.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Step 1
  await (adapter as any).fillSourceDropdown(page);
  await (adapter as any).fillPreviouslyWorkedQuestion(page);
  await (adapter as any).fillPersonalInfoFields(page, profile);
  await (adapter as any).formatNamesToTitleCase(page, profile);
  await (adapter as any).fillAddressAndContact(page, profile);
  await (adapter as any).cleanAndFillPhoneNumber(page, profile);

  const phoneTypeBtn = page.locator("button[data-automation-id='phone-device-type'], button[id*='phone-device-type'], div[data-automation-id*='phone-device-type'] button").first();
  if (await phoneTypeBtn.count() > 0 && await phoneTypeBtn.isVisible().catch(() => false)) {
    const curVal = await phoneTypeBtn.innerText().catch(() => "");
    if (!curVal || curVal.includes("Select One") || curVal.includes("Select")) {
      await phoneTypeBtn.click();
      await page.waitForTimeout(500);
      const mob = page.locator("[role='option']:has-text('Mobile')").first();
      if (await mob.count() > 0) await mob.click({ force: true });
      await page.waitForTimeout(300);
    }
  }

  // Click Save and Continue
  await page.locator("button:has-text('Save and Continue')").last().click({ force: true });
  await page.waitForTimeout(6000);

  // Click Education Add button accurately:
  // Find heading "Education" and find its Add button
  console.log("Finding and clicking Education Add button...");
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h4"));
    const eduH4 = headings.find(h => h.textContent?.trim().toLowerCase() === "education");
    if (!eduH4) return;
    // Find the closest sibling or parent container containing an Add button
    let el: Element | null = eduH4;
    while (el && !el.querySelector("button[data-automation-id='add-button'], button")) {
      el = el.parentElement;
    }
    // Or check nextElementSibling
    let next = eduH4.nextElementSibling;
    while (next) {
      const btn = next.querySelector("button") || (next.tagName === "BUTTON" ? next : null);
      if (btn) {
        (btn as HTMLButtonElement).click();
        return;
      }
      next = next.nextElementSibling;
    }
    const btn = el?.querySelector("button");
    if (btn) btn.click();
  });
  await page.waitForTimeout(2000);

  // Also click Websites Add button
  console.log("Finding and clicking Websites Add button...");
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h4"));
    const webH4 = headings.find(h => h.textContent?.trim().toLowerCase() === "websites");
    if (!webH4) return;
    let next = webH4.nextElementSibling;
    while (next) {
      const btn = next.querySelector("button") || (next.tagName === "BUTTON" ? next : null);
      if (btn) {
        (btn as HTMLButtonElement).click();
        return;
      }
      next = next.nextElementSibling;
    }
    let el: Element | null = webH4;
    while (el && !el.querySelector("button")) {
      el = el.parentElement;
    }
    const btn = el?.querySelector("button");
    if (btn) btn.click();
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "scratch/clario_education_expanded.png", fullPage: true });

  const eduAndWebInputs = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("input, textarea, select, button[aria-haspopup='listbox'], button[id*='dropdown'], button[data-automation-id*='prompt']"));
    return all.map(el => ({
      tag: el.tagName,
      id: el.id,
      autoId: el.getAttribute("data-automation-id"),
      name: (el as HTMLInputElement).name,
      type: (el as HTMLInputElement).type,
      placeholder: (el as HTMLInputElement).placeholder,
      aria: el.getAttribute("aria-label"),
      text: el.textContent?.trim()?.slice(0, 40)
    }));
  });

  console.log("ALL INPUTS AFTER EDU & WEB ADD:\n", JSON.stringify(eduAndWebInputs, null, 2));

  await browser.close();
}

main().catch(console.error);
