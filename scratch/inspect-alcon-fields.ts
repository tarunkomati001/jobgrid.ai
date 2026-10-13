import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import * as path from "path";

async function main() {
  const testUrl = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    console.log("Navigating to Alcon...");
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    // Accept cookies
    const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
    if (await cookieBtn.count() > 0 && await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click();
      await page.waitForTimeout(1000);
    }

    // Click Apply
    const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first();
    if (await applyBtn.count() > 0) {
      await applyBtn.click({ force: true });
      await page.waitForTimeout(3000);
    }

    // Click Autofill with Resume
    const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
    if (await autofillOption.count() > 0) {
      await autofillOption.click({ force: true });
      await page.waitForTimeout(3000);
    }

    // Auth screen: check if Sign In tab is needed
    const emailInput = page.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first();
    await emailInput.waitFor({ timeout: 15000 }).catch(() => {});

    const signInTab = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
    if (await signInTab.count() > 0 && await signInTab.isVisible().catch(() => false)) {
      console.log("Switching to Sign In tab...");
      await signInTab.click();
      await page.waitForTimeout(2000);
    }

    console.log("Filling Sign In credentials...");
    const emailLoc = page.locator("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName']").first();
    await emailLoc.fill("babufakemail@gmail.com");
    const pwLoc = page.locator("input[data-automation-id='password'], input[name='password']").first();
    await pwLoc.fill("Tarun@143");

    const signInBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
    if (await signInBtn.count() > 0) {
      console.log("Submitting Sign In...");
      await signInBtn.click();
      await page.waitForTimeout(8000);
    }

    console.log("Current URL after login:", page.url());

    // Check if resume upload input is present
    const fileInput = page.locator("input[type='file'], [data-automation-id='file-upload-drop-zone'] input").first();
    if (await fileInput.count() > 0) {
      console.log("Uploading resume...");
      const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
      await fileInput.setInputFiles(resumePath);
      await page.waitForTimeout(6000);

      const continueBtn = page.locator("button[data-automation-id='bottom-navigation-next-button'], [data-automation-id='click_filter'][aria-label*='Continue']").last();
      if (await continueBtn.count() > 0) {
        await continueBtn.click({ force: true });
        await page.waitForTimeout(8000);
      }
    }

    console.log("Now on Wizard page. URL:", page.url());
    await page.screenshot({ path: "scratch/alcon_my_info_screen.png", fullPage: true });

    // Inspect all form fields, labels, inputs, dropdowns on My Information
    const elements = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("label, input, button, select, fieldset, div[data-automation-id]"));
      return all.map(el => {
        const tag = el.tagName.toLowerCase();
        const autoId = el.getAttribute("data-automation-id") || "";
        const id = el.id || "";
        const role = el.getAttribute("role") || "";
        const ariaLabel = el.getAttribute("aria-label") || "";
        const text = el.textContent?.trim().slice(0, 80) || "";
        const val = (el as HTMLInputElement).value;
        return { tag, autoId, id, role, ariaLabel, text, val };
      }).filter(x => 
        x.autoId.includes("source") ||
        x.autoId.includes("phone") ||
        x.autoId.includes("Name") ||
        x.autoId.includes("previous") ||
        x.id.includes("source") ||
        x.id.includes("phone") ||
        x.id.includes("Name") ||
        x.id.includes("previous") ||
        x.ariaLabel.toLowerCase().includes("source") ||
        x.ariaLabel.toLowerCase().includes("phone") ||
        x.ariaLabel.toLowerCase().includes("worked") ||
        x.text.toLowerCase().includes("hear about us") ||
        x.text.toLowerCase().includes("previously worked") ||
        x.text.toLowerCase().includes("phone number")
      );
    });

    console.log("Relevant elements found:", JSON.stringify(elements, null, 2));

  } catch (err: any) {
    console.error("Error inspecting Alcon:", err.message);
    await page.screenshot({ path: "scratch/alcon_inspect_error.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main();
