import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import path from "path";
import fs from "fs";

async function probeSteps() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to Job 1 Apply...");
  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Cookie dismiss
  const cookieBtn = page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // Remove backdrop
  await page.evaluate(() => {
    document.querySelectorAll(".backdrop, .modal-backdrop, #onetrust-consent-sdk, [id='0citrus-modal-wrapper']").forEach(el => el.remove());
    document.body.classList.remove("modal-open");
  });

  // Attach resume
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  console.log("Attaching resume...");
  await page.setInputFiles("input#btn-resume, input[type='file'][id*='resume']", resumePath);
  await page.waitForTimeout(1000);

  // Attach cover letter
  const clPath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Cover_Letter.pdf");
  if (fs.existsSync(clPath)) {
    console.log("Attaching cover letter...");
    await page.setInputFiles("input#btn-coverLetter, input[type='file'][id*='coverLetter']", clPath).catch(() => {});
    await page.waitForTimeout(500);
  }

  // Uncheck resume auto-fill so our manual data takes precedence cleanly
  await page.evaluate(() => {
    const cb: any = document.getElementById("useAttachedResumeToFillOutApplication");
    if (cb && cb.checked) {
      cb.checked = false;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  // Fill Step 1 personal info
  console.log("Filling Step 1 personal info...");
  await page.locator("input[id='info.firstName']").fill("Hrutin");
  await page.locator("input[id='info.lastName']").fill("Nammi");
  await page.locator("input[id='info.preferredName']").fill("Hrutin");
  await page.locator("input[id='info.email']").fill("babufakemail@gmail.com");
  await page.locator("input[id='info.cellPhone']").fill("+12025550198");
  await page.locator("input[id='info.phone']").fill("+12025550198");

  // Dropdowns on Step 1
  console.log("Filling Step 1 dropdowns...");
  // Applied before -> No
  const appliedCb = page.locator("[id='info.haveYouAppliedWithUsBefore']");
  if (await appliedCb.count() > 0) {
    await appliedCb.click({ force: true });
    await page.waitForTimeout(200);
    const opt = page.locator(".rw-list-option:has-text('No'), li:has-text('No')").first();
    if (await opt.count() > 0) await opt.click({ force: true });
  }

  // SMS opt-in -> Yes*
  const smsCb = page.locator("[id='info.smsOptedIn']");
  if (await smsCb.count() > 0) {
    await smsCb.click({ force: true });
    await page.waitForTimeout(200);
    const opt = page.locator(".rw-list-option:has-text('Yes'), li:has-text('Yes')").first();
    if (await opt.count() > 0) await opt.click({ force: true });
  }

  // Address
  await page.locator("input[id='public-site-address-country']").fill("United States");
  await page.locator("input[id='public-site-address-address-1']").fill("123 Market St");
  await page.locator("input[id='public-site-address-address-2']").fill("Suite 400");
  await page.locator("input[id='public-site-address-city']").fill("San Francisco");
  await page.locator("input[id='public-site-address-county']").fill("San Francisco County");
  await page.locator("input[id='public-site-address-zip']").fill("94105");

  // State dropdown
  const stateWrapper = page.locator("#public-site-address-us-state-select-wrapper");
  if (await stateWrapper.count() > 0) {
    const icon = stateWrapper.locator(".pcty-input-select__dropdown-icon, .pcty-input-select__control").first();
    await icon.click({ force: true });
    await page.waitForTimeout(200);
    const opt = page.locator(".pcty-input-select__menu-list div:visible").filter({ hasText: /^CA$/i }).first();
    if (await opt.count() > 0) {
      await opt.click({ force: true });
    } else {
      await page.keyboard.press("Enter");
    }
  }

  // Available to start & salary
  await page.locator("input[id='info.dateAvailableToStart']").fill("11/01/2026");
  const salaryTypeCb = page.locator("[id='info.desiredSalaryType']");
  if (await salaryTypeCb.count() > 0) {
    await salaryTypeCb.click({ force: true });
    await page.waitForTimeout(200);
    const opt = page.locator(".rw-list-option:has-text('Yearly'), li:has-text('Yearly')").first();
    if (await opt.count() > 0) await opt.click({ force: true });
  }
  await page.locator("input[id='info.minimumDesiredSalary']").fill("95000");
  await page.locator("input[id='info.maximumDesiredSalary']").fill("115000");

  // Radio: How did you hear
  await page.evaluate(() => {
    const r: any = document.querySelector("input[type='radio'][value='Company Website']") || document.querySelector("input[type='radio']");
    if (r) {
      r.checked = true;
      const l = r.closest("label") || document.querySelector(`label[for='${r.id}']`);
      if (l) l.click();
      r.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  // Referred by
  await page.locator("input[id='info.referredBy']").fill("Tarun Komati");

  // Skills tags
  const skillsInput = page.locator("input[id='info.skills']");
  if (await skillsInput.count() > 0) {
    for (const s of ["TypeScript", "Python", "React", "Node.js", "Docker"]) {
      await skillsInput.fill(s);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
    }
  }

  // Worked with us before -> No
  const workedWithUs = page.locator("[id='info.haveYouWorkedWithUsBefore']");
  if (await workedWithUs.count() > 0) {
    await workedWithUs.click({ force: true });
    await page.waitForTimeout(200);
    const opt = page.locator(".rw-list-option:has-text('No'), li:has-text('No')").first();
    if (await opt.count() > 0) await opt.click({ force: true });
  }

  await page.screenshot({ path: "scratch/step1_filled.png", fullPage: true });
  console.log("Step 1 screenshot saved to scratch/step1_filled.png");

  // Purge overlays before clicking Next Step
  await page.evaluate(() => {
    document.querySelectorAll(".backdrop, .modal-backdrop, #onetrust-consent-sdk, [id='0citrus-modal-wrapper']").forEach(el => el.remove());
    document.body.classList.remove("modal-open");
  });

  // Click Next Step
  console.log("Clicking Next Step on Step 1...");
  const nextBtn = page.locator("button#btn-submit, button[type='submit']:has-text('Next Step')").first();
  await nextBtn.click({ force: true });
  await page.waitForTimeout(4000);

  // Check where we are now
  const stepText = await page.locator("p:has-text('Step'), [class*='step']").first().innerText().catch(() => "");
  console.log(`Current step indicator: "${stepText}"`);
  console.log(`Current URL: ${page.url()}`);

  // Check validation errors if any
  const errors = await page.locator(".text-danger, span[style*='color: red'], .has-error, .field-validation-error").allInnerTexts().catch(() => []);
  console.log("Validation errors after Next Step click:", errors);

  console.log("\n=======================================================");
  console.log("FILLING STEP 2: Work & Education History");
  console.log("=======================================================");

  // Fill reasons for leaving
  const reasons = page.locator("input[id*='reasonForLeaving'], textarea[id*='reasonForLeaving']");
  const reasonCount = await reasons.count();
  for (let i = 0; i < reasonCount; i++) {
    const r = reasons.nth(i);
    const val = await r.inputValue().catch(() => "");
    if (!val) {
      await r.fill("Career advancement and professional growth in AI engineering");
      console.log(`Filled reasonForLeaving #${i}`);
    }
  }

  // Set May We Contact for Reference on all work entries -> Yes
  const contactCbs = page.locator("div[id*='mayWeContactSupervisor']");
  const contactCount = await contactCbs.count();
  for (let i = 0; i < contactCount; i++) {
    const cb = contactCbs.nth(i);
    const val = (await cb.locator(".rw-input").innerText().catch(() => "")).trim();
    if (!val || val === "--") {
      console.log(`Selecting Contact Reference #${i} -> Yes...`);
      await cb.click({ force: true });
      await page.waitForTimeout(200);
      const opt = page.locator(".rw-list-option:has-text('Yes'), li:has-text('Yes')").first();
      if (await opt.count() > 0) await opt.click({ force: true });
      await page.waitForTimeout(200);
    }
  }

  // Set Education State -> California
  const eduStateCbs = page.locator("div[id*='educationHistory.state']");
  const eduStateCount = await eduStateCbs.count();
  for (let i = 0; i < eduStateCount; i++) {
    const cb = eduStateCbs.nth(i);
    const val = (await cb.locator(".rw-input").innerText().catch(() => "")).trim();
    if (!val || val === "--") {
      console.log(`Selecting Education State #${i} -> California...`);
      await cb.click({ force: true });
      await page.waitForTimeout(200);
      const opt = page.locator(".rw-list-option:has-text('California'), li:has-text('California')").first();
      if (await opt.count() > 0) await opt.click({ force: true });
      await page.waitForTimeout(200);
    }
  }

  // Set Education Degree if -- or Other -> Bachelor
  const degreeCbs = page.locator("div[id*='educationHistory.degreeId']");
  const degreeCount = await degreeCbs.count();
  for (let i = 0; i < degreeCount; i++) {
    const cb = degreeCbs.nth(i);
    const val = (await cb.locator(".rw-input").innerText().catch(() => "")).trim();
    if (!val || val === "--" || val === "Other") {
      console.log(`Selecting Education Degree #${i} -> Bachelor...`);
      await cb.click({ force: true });
      await page.waitForTimeout(200);
      const opt = page.locator(".rw-list-option:has-text('Bachelor'), li:has-text('Bachelor')").first();
      if (await opt.count() > 0) await opt.click({ force: true });
      await page.waitForTimeout(200);
    }
  }

  // Purge overlays before clicking Next Step
  await page.evaluate(() => {
    document.querySelectorAll(".backdrop, .modal-backdrop, #onetrust-consent-sdk, [id='0citrus-modal-wrapper']").forEach(el => el.remove());
    document.body.classList.remove("modal-open");
  });

  console.log("Clicking Next Step on Step 2...");
  const nextBtn2 = page.locator("button#btn-submit, button[type='submit']:has-text('Next Step')").first();
  await nextBtn2.click({ force: true });
  await page.waitForTimeout(4000);

  // Check Step 3 / 5
  const stepText2 = await page.locator("p:has-text('Step'), [class*='step']").first().innerText().catch(() => "");
  console.log(`After Step 2, indicator: "${stepText2}" URL: ${page.url()}`);
  await page.screenshot({ path: "scratch/after_step2.png", fullPage: true });

  await browser.close();
}

probeSteps().catch(console.error);
