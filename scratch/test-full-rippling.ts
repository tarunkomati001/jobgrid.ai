import { chromium } from "playwright";
import * as path from "path";

async function runTest(url: string) {
  console.log(`\n=================== Testing Rippling Fill: ${url} ===================`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const applyBtn = page.locator("button:has-text('Apply now')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(1500);
  }

  // 1. Resume
  const resumeInput = page.locator("input[type='file'][data-testid='input-resume']").first();
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  if (await resumeInput.count() > 0) {
    await resumeInput.setInputFiles(resumePath);
    console.log("📄 Resume attached");
  }

  // 2. Cover letter
  const clInput = page.locator("input[type='file'][data-testid='input-cover_letter']").first();
  const clPath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Cover_Letter.pdf");
  if (await clInput.count() > 0) {
    await clInput.setInputFiles(clPath);
    console.log("📄 Cover letter attached");
  }

  // 3. First name
  const fn = page.locator("input[data-testid='input-first_name']").first();
  if (await fn.count() > 0) {
    await fn.fill("Hrutin");
    console.log("👤 First name filled");
  }

  // 4. Last name
  const ln = page.locator("input[data-testid='input-last_name']").first();
  if (await ln.count() > 0) {
    await ln.fill("Nammi");
    console.log("👤 Last name filled");
  }

  // 5. Email
  const email = page.locator("input[data-testid='input-email']").first();
  if (await email.count() > 0) {
    await email.fill("hrutinnammi@gmail.com");
    console.log("📧 Email filled");
  }

  // 6. Current company
  const company = page.locator("input[data-testid='input-current_company']").first();
  if (await company.count() > 0) {
    await company.fill("TechCorp Inc");
    console.log("🏢 Company filled");
  }

  // 7. Phone country code
  const phoneCode = page.locator("div[data-testid='phone_number-code'] input[data-testid='input-select-search-input']").first();
  if (await phoneCode.count() > 0) {
    await phoneCode.click();
    await phoneCode.fill("United States");
    await page.waitForTimeout(600);
    const usOption = page.locator("li[role='option']:has-text('United States'), li[role='option']:has-text('+1 US')").first();
    if (await usOption.count() > 0) {
      await usOption.click();
      console.log("📞 Phone country selected: United States (+1)");
    }
  }

  // 8. Phone number
  const phone = page.locator("input[data-testid='input-phone_number']").first();
  if (await phone.count() > 0) {
    await phone.fill("4155550198");
    console.log("📞 Phone number filled");
  }

  // 9. Pronouns
  const pronounField = page.locator("div[data-testid='pronouns_strategy'] input").first();
  if (await pronounField.count() > 0) {
    await pronounField.click();
    await pronounField.fill("He/Him");
    await page.waitForTimeout(600);
    const opt = page.locator("li[role='option']:has-text('He/Him')").first();
    if (await opt.count() > 0) {
      await opt.click();
      console.log("⚧ Pronouns selected: He/Him");
    } else {
      // try pressing Enter
      await page.keyboard.press("Enter");
      console.log("⚧ Pronouns entered via keypress");
    }
  }

  // 10. Location
  const locInput = page.locator("div[data-testid='location'] input").first();
  if (await locInput.count() > 0) {
    await locInput.click();
    await locInput.fill("San Francisco, CA");
    await page.waitForTimeout(1000);
    const locOption = page.locator("li[role='option'], div[role='option'], div[class*='suggestion']:has-text('San Francisco')").first();
    if (await locOption.count() > 0) {
      await locOption.click();
      console.log("📍 Location selected: " + await locOption.innerText());
    } else {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      console.log("📍 Location selected via ArrowDown+Enter");
    }
  }

  // 11. LinkedIn Link
  const linkedin = page.locator("input[data-testid='input-linkedin_link']").first();
  if (await linkedin.count() > 0) {
    await linkedin.fill("https://www.linkedin.com/in/hrutin-nammi");
    console.log("🔗 LinkedIn filled");
  }

  // 12. Custom questions (comboboxes / text inputs / etc.)
  const customCombos = page.locator("div[data-testid*='customQuestions'] [data-testid='select-controller']");
  const ccCount = await customCombos.count();
  for (let i = 0; i < ccCount; i++) {
    const ctrl = customCombos.nth(i);
    // Find question context
    const qText = await ctrl.evaluate(el => {
      let p = el.parentElement;
      while (p && p.tagName !== 'FORM' && p.tagName !== 'BODY') {
        const textEl = p.querySelector('p, h4, h5, label');
        if (textEl && textEl.textContent && textEl.textContent.trim().length > 5) {
          return textEl.textContent.trim();
        }
        if (p.previousElementSibling) {
          const prevP = p.previousElementSibling.querySelector('p, h4, h5, label');
          if (prevP && prevP.textContent) return prevP.textContent.trim();
        }
        p = p.parentElement;
      }
      return "";
    });
    console.log(`❓ Custom question ${i + 1}: "${qText}"`);
    await ctrl.click();
    await page.waitForTimeout(500);

    // If sponsorship question -> "No"
    let target = "No";
    if (qText.toLowerCase().includes("sponsorship")) {
      target = "No";
    } else if (qText.toLowerCase().includes("authorized") || qText.toLowerCase().includes("legally")) {
      target = "Yes";
    }
    const option = page.locator(`li[role='option']:has-text('${target}')`).first();
    if (await option.count() > 0) {
      await option.click();
      console.log(`   Selected: ${target}`);
    } else {
      const firstOpt = page.locator("li[role='option']").first();
      if (await firstOpt.count() > 0) {
        const txt = await firstOpt.innerText();
        await firstOpt.click();
        console.log(`   Selected fallback: ${txt}`);
      }
    }
  }

  // 13. EEOC Gender
  const genderCtrl = page.locator("div[data-testid='eeoc.gender'] [data-testid='select-controller']").first();
  if (await genderCtrl.count() > 0) {
    await genderCtrl.click();
    await page.waitForTimeout(500);
    const mOpt = page.locator("li[role='option']:has-text('Male')").first();
    if (await mOpt.count() > 0) {
      await mOpt.click();
      console.log("⚖️ EEOC Gender selected: Male");
    }
  }

  // 14. EEOC Race
  const raceInput = page.locator("div[data-testid='eeoc.race'] input[data-testid='input-select-search-input']").first();
  if (await raceInput.count() > 0) {
    await raceInput.click();
    await raceInput.fill("Asian");
    await page.waitForTimeout(500);
    const rOpt = page.locator("li[role='option']:has-text('Asian')").first();
    if (await rOpt.count() > 0) {
      await rOpt.click();
      console.log("⚖️ EEOC Race selected: Asian");
    }
  }

  // 15. EEOC Hispanic / Latino
  const hispCtrl = page.locator("div[data-testid='eeoc.hispanicOrLatino'] [data-testid='select-controller']").first();
  if (await hispCtrl.count() > 0) {
    await hispCtrl.click();
    await page.waitForTimeout(500);
    const noOpt = page.locator("li[role='option']:has-text('No')").first();
    if (await noOpt.count() > 0) {
      await noOpt.click();
      console.log("⚖️ EEOC Hispanic/Latino selected: No");
    }
  }

  // 16. EEOC Veteran Status
  const vetCtrl = page.locator("div[data-testid='eeoc.veteranStatus'] [data-testid='select-controller']").first();
  if (await vetCtrl.count() > 0) {
    await vetCtrl.click();
    await page.waitForTimeout(500);
    const vetOpt = page.locator("li[role='option']:has-text('not a protected veteran')").first();
    if (await vetOpt.count() > 0) {
      await vetOpt.click();
      console.log("⚖️ EEOC Veteran selected: I am not a protected veteran");
    }
  }

  // 17. SMS Consent Radio
  const smsConsent = page.locator("div[data-testid='radio-label-sms_opt_in'][data-value='true']").first();
  if (await smsConsent.count() > 0) {
    await smsConsent.click();
    console.log("💬 SMS Consent clicked: Yes");
  }

  await page.waitForTimeout(2000);
  const screenshotPath = `scratch/rippling_filled_${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);

  await browser.close();
}

async function main() {
  await runTest("https://ats.rippling.com/en-GB/rippling/jobs/94486f41-6474-446a-b67a-c164e11354ea");
  await runTest("https://ats.rippling.com/en-GB/rippling/jobs/1584be38-83a9-41a8-94e8-f733332ace4e");
}

main().catch(console.error);
