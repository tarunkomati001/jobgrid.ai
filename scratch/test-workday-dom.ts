import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const testUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1";
  console.log("Navigating to Workday URL:", testUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 850 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    console.log("\n==========================================");
    console.log("Testing Workday URL:", testUrl);
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);
    console.log("Navigating to:", testUrl);
    await page.goto(testUrl, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);

    // Accept cookies if present
    const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
    if (await cookieBtn.count() > 0) {
      await cookieBtn.click();
      await page.waitForTimeout(1000);
    }

    const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first();
    console.log("Apply button count:", await applyBtn.count());
    if (await applyBtn.count() > 0) {
      console.log("Clicking Apply button...");
      await applyBtn.click();
      await page.waitForTimeout(5000);
    }

    const autofillBtn = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
    console.log("Autofill with Resume button count:", await autofillBtn.count());
    if (await autofillBtn.count() > 0) {
      console.log("Clicking 'Autofill with Resume'...");
      await autofillBtn.click();
      await page.waitForTimeout(5000);
    }

    console.log("URL after clicking Autofill with Resume:", page.url());
    console.log("Waiting for auth inputs to mount...");
    await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName'], button[data-automation-id='createAccountSubmitButton']", { timeout: 15000 }).catch(() => {
      console.log("Timeout waiting for data-automation-id inputs, checking general inputs...");
    });
    await page.waitForTimeout(1000);

    const authInputs = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("input, button, a"));
      return els.map(e => ({
        tag: e.tagName,
        type: (e as HTMLInputElement).type,
        dataAutomationId: e.getAttribute("data-automation-id"),
        text: (e as HTMLElement).innerText?.trim() || (e as HTMLInputElement).placeholder || (e as HTMLInputElement).name,
        ariaLabel: e.getAttribute("aria-label")
      })).filter(e => e.dataAutomationId || e.type === "password" || e.type === "email" || e.text?.toLowerCase().includes("create") || e.text?.toLowerCase().includes("sign in"));
    });
    console.log("Auth inputs / buttons:", JSON.stringify(authInputs, null, 2));

    await page.screenshot({ path: "scratch/workday_auth_screen.png", fullPage: true });

    // Now let's test filling the fields and checking why create button might be disabled
    console.log("\n--- Testing Complete Workday Auth & Application Flow ---");
    
    // Check if verifyPassword exists -> CREATE ACCOUNT MODE
    const verifyPwInput = page.locator("input[data-automation-id='verifyPassword']").first();
    const hasVerifyPw = (await verifyPwInput.count()) > 0 && (await verifyPwInput.isVisible().catch(() => false));
    console.log("Has verifyPassword (is Create Account?):", hasVerifyPw);

    const testEmail = "babufakemail@gmail.com";
    const testPw = process.env.WORKDAY_PASSWORD || "Tarun@143";

    if (hasVerifyPw) {
      console.log("👉 Performing CREATE ACCOUNT with email:", testEmail);
      
      // 1. Email
      const emailInput = page.locator("input[data-automation-id='email']").first();
      await emailInput.focus();
      await emailInput.fill(testEmail);
      await emailInput.dispatchEvent("input");
      await emailInput.dispatchEvent("change");
      await emailInput.blur();
      await page.waitForTimeout(300);

      // 2. Password
      const pwInput = page.locator("input[data-automation-id='password']").first();
      await pwInput.focus();
      await pwInput.fill(testPw);
      await pwInput.dispatchEvent("input");
      await pwInput.dispatchEvent("change");
      await pwInput.blur();
      await page.waitForTimeout(300);

      // 3. Verify Password - Use both fill and native prototype setter to guarantee 100% exact match
      await verifyPwInput.focus();
      await verifyPwInput.fill(testPw);
      await page.evaluate(({ val }) => {
        const el = document.querySelector("input[data-automation-id='verifyPassword']") as HTMLInputElement;
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, { val: testPw });
      await verifyPwInput.blur();
      await page.waitForTimeout(500);

      console.log("Password value length:", (await pwInput.inputValue()).length);
      console.log("VerifyPassword value length:", (await verifyPwInput.inputValue()).length);

      // Check checkbox if present
      const cb = page.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox']").first();
      if (await cb.count() > 0 && !await cb.isChecked()) {
        await cb.check({ force: true });
        await cb.dispatchEvent("change");
      }

      await page.screenshot({ path: "scratch/ready_to_click_create.png" });

      // Click Create Account button
      console.log("Clicking Create Account button...");
      const createBtn = page.locator("[data-automation-id='click_filter'][aria-label='Create Account'], button[data-automation-id='createAccountSubmitButton']").first();
      const box = await createBtn.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await createBtn.click({ force: true });
      }
      
      console.log("Waiting for Workday post-create transition (6s)...");
      await page.waitForTimeout(6000);
      console.log("Current URL after create account click:", page.url());
      await page.screenshot({ path: "scratch/after_create_click.png" });
    }

    // Now check if on Sign In screen (/login or signInSubmitButton)
    const isLoginPage = page.url().includes("/login") || (await page.locator("button[data-automation-id='signInSubmitButton'], [data-automation-id='click_filter'][aria-label='Sign In']").count()) > 0;
    console.log("Is on Sign In screen:", isLoginPage);

    if (isLoginPage) {
      console.log("👉 Performing SIGN IN with email & password...");
      console.log("Waiting for Sign In inputs to mount...");
      await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName']", { timeout: 15000 });
      await page.waitForTimeout(1000);

      const signInEmail = page.locator("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName']").first();
      console.log("Sign In email input count:", await signInEmail.count());
      if (await signInEmail.count() > 0) {
        await signInEmail.focus();
        await signInEmail.fill(testEmail);
        await signInEmail.dispatchEvent("input");
        await signInEmail.dispatchEvent("change");
        await signInEmail.blur();
        await page.waitForTimeout(300);
      }

      const signInPw = page.locator("input[data-automation-id='password']").first();
      console.log("Sign In pw input count:", await signInPw.count());
      if (await signInPw.count() > 0) {
        await signInPw.focus();
        await signInPw.fill(testPw);
        await signInPw.dispatchEvent("input");
        await signInPw.dispatchEvent("change");
        await signInPw.blur();
        await page.waitForTimeout(300);
      }

      console.log("Clicking Sign In button...");
      const signInBtn = page.locator("[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
      const sBox = await signInBtn.boundingBox();
      if (sBox) {
        await page.mouse.click(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
      } else {
        await signInBtn.click({ force: true });
      }

      console.log("Waiting for login redirect past /login...");
      await page.waitForTimeout(10000);
      console.log("URL after login:", page.url());
      await page.screenshot({ path: "scratch/after_login_redirect.png" });
    }

    // Now check if resume upload is present
    const fileInput = page.locator("input[type='file'], [data-automation-id='file-upload-drop-zone'] input").first();
    const hasFileInput = await fileInput.waitFor({ state: "attached", timeout: 10000 }).then(() => true).catch(() => false);
    console.log("Has resume file input:", hasFileInput);

    if (hasFileInput) {
      const resumePath = "C:\\Users\\tarun\\Downloads\\cluco.ai\\cluco.ai\\resumes\\user_usr_hrutin_nammi\\Hrutin_Nammi_Resume.pdf";
      console.log("Uploading resume:", resumePath);
      await fileInput.setInputFiles(resumePath);
      await page.waitForTimeout(6000);

      // Click Continue to advance to Step 1
      const continueBtn = page.locator("[data-automation-id='click_filter'][aria-label*='Continue'], button[data-automation-id='bottom-navigation-next-button'], button:has-text('Continue')").last();
      console.log("Advancing past resume upload...");
      const cBox = await continueBtn.boundingBox();
      if (cBox) {
        await page.mouse.click(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2);
      } else {
        await continueBtn.click({ force: true });
      }
      await page.waitForTimeout(8000);
    }

    console.log("Current URL on wizard:", page.url());
    await page.screenshot({ path: "scratch/wizard_step2_my_info.png" });

    // Inspect all inputs on My Information
    const infoInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("input, button[aria-haspopup='listbox'], select")).map(e => ({
        tag: e.tagName,
        id: e.getAttribute("data-automation-id") || e.id,
        label: e.getAttribute("aria-label") || (e as HTMLElement).innerText?.slice(0, 30),
        val: (e as HTMLInputElement).value
      }));
    });
    console.log("My Information inputs:", JSON.stringify(infoInputs, null, 2));

    // 1. Close any open dialog/drawer if present
    const closeDrawer = page.locator("button[aria-label='Close'], button:has-text('✕')").first();
    if (await closeDrawer.count() > 0 && await closeDrawer.isVisible().catch(() => false)) {
      await closeDrawer.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    // Loop through remaining wizard steps up to review/submit
    for (let wStep = 2; wStep <= 7; wStep++) {
      console.log(`\n========================================`);
      console.log(`Processing Wizard Step ${wStep}...`);
      await page.screenshot({ path: `scratch/wizard_step_${wStep}.png` });

      // Check if Review step or Submit button reached
      const isReviewOrSubmit = await page.evaluate(() => {
        const text = document.body?.innerText || "";
        const hasSubmit = Array.from(document.querySelectorAll("button")).some(b => b.innerText.trim().toLowerCase() === "submit");
        return text.includes("Please review your information before submitting") || hasSubmit;
      });

      if (isReviewOrSubmit) {
        console.log("🎯 REACHED FINAL REVIEW STEP! Submit button is ready.");
        await page.screenshot({ path: "scratch/wizard_final_review.png" });
        break;
      }

      // Handle "How Did You Hear About Us?" dropdown
      const sourceBtn = page.locator("button[data-automation-id='source--source'], button[id*='source--source']").first();
      if (await sourceBtn.count() > 0) {
        const curText = (await sourceBtn.innerText().catch(() => "")).trim();
        if (!curText || curText.includes("Select One") || curText.includes("Select")) {
          console.log("  Selecting source dropdown...");
          await sourceBtn.click();
          await page.waitForTimeout(600);
          const opt = page.locator("[role='option']:has-text('LinkedIn'), [role='option']:has-text('Other'), [role='option']").first();
          if (await opt.count() > 0) await opt.click();
          await page.waitForTimeout(500);
        }
      }

      // Fill Name fields
      const firstName = page.locator("input[id*='firstName']").first();
      if (await firstName.count() > 0) {
        await firstName.fill("Hrutin");
      }
      const lastName = page.locator("input[id*='lastName']").first();
      if (await lastName.count() > 0) {
        await lastName.fill("Kumar");
      }

      // Fill Address Line 1
      const addr1 = page.locator("input[id*='addressLine1']").first();
      if (await addr1.count() > 0 && !(await addr1.inputValue())) {
        await addr1.fill("101 High Street");
      }

      // Fill City
      const city = page.locator("input[id*='city']").first();
      if (await city.count() > 0 && !(await city.inputValue())) {
        await city.fill("Vadodara");
      }

      // Fill Postal Code
      const zip = page.locator("input[id*='postalCode']").first();
      if (await zip.count() > 0 && !(await zip.inputValue())) {
        await zip.fill("390001");
      }

      // Fill Phone Device Type
      const phoneType = page.locator("button[id*='phoneType']").first();
      if (await phoneType.count() > 0) {
        const pText = (await phoneType.innerText().catch(() => "")).trim();
        if (!pText || pText.includes("Select One")) {
          await phoneType.click();
          await page.waitForTimeout(500);
          const mobOpt = page.locator("[role='option']:has-text('Mobile'), [role='option']").first();
          if (await mobOpt.count() > 0) await mobOpt.click();
          await page.waitForTimeout(300);
        }
      }

      // Fill Radio Questions (Yes/No)
      const fieldsets = page.locator("fieldset, [role='radiogroup']");
      const fsCount = await fieldsets.count();
      for (let i = 0; i < fsCount; i++) {
        const fs = fieldsets.nth(i);
        const hasChecked = (await fs.locator("input[type='radio']:checked").count()) > 0;
        if (!hasChecked) {
          const fsText = (await fs.innerText().catch(() => "")).toLowerCase();
          let target = "Yes";
          if (fsText.includes("sponsorship") || fsText.includes("require visa") || fsText.includes("felony")) {
            target = "No";
          }
          const rBtn = fs.locator(`label:has-text('${target}'), input[value*='${target}' i]`).first();
          if (await rBtn.count() > 0) {
            await rBtn.click({ force: true }).catch(() => {});
          } else {
            const firstRadio = fs.locator("input[type='radio'], label").first();
            if (await firstRadio.count() > 0) await firstRadio.click({ force: true }).catch(() => {});
          }
        }
      }

      // Fill required empty text inputs
      const emptyReq = page.locator("input[aria-required='true']:not([type='hidden']):not([type='file']), textarea[aria-required='true']");
      const reqCount = await emptyReq.count();
      for (let i = 0; i < reqCount; i++) {
        const inp = emptyReq.nth(i);
        const v = await inp.inputValue().catch(() => "");
        if (!v.trim()) {
          await inp.fill("None / Not Applicable");
        }
      }

      // Check any required checkboxes
      const cbs = page.locator("input[type='checkbox'][aria-required='true']:not(:checked)");
      const cbCount = await cbs.count();
      for (let i = 0; i < cbCount; i++) {
        await cbs.nth(i).check({ force: true }).catch(() => {});
      }

      await page.waitForTimeout(1000);

      // Click Save and Continue
      console.log("Clicking Save and Continue / Next...");
      const nextBtn = page.locator("button[data-automation-id='bottom-navigation-next-button'], button:has-text('Save and Continue'), button:has-text('Next')").last();
      const nBox = await nextBtn.boundingBox();
      if (nBox) {
        await page.mouse.click(nBox.x + nBox.width / 2, nBox.y + nBox.height / 2);
      } else {
        await nextBtn.click({ force: true });
      }
      await page.waitForTimeout(7000);
      console.log(`Finished Step ${wStep}, current URL:`, page.url());
    }
  } catch (err: any) {
    console.error("Error during Workday DOM test:", err.message);
  } finally {
    await browser.close();
  }
}

main();
