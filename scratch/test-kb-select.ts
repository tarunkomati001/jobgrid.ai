import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testKeyboardSelect() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(8000);

  // Fill Confirm Email
  await page.locator("spl-input#confirm-email-input input").fill("hrutinnammi8@gmail.com");

  // Fix draft experience if open
  const isExpOpen = await page.locator("oc-button[data-test='experience-save'] button").count();
  if (isExpOpen > 0) {
    await page.evaluate(`(() => {
      const cb = document.querySelector("oc-experience spl-checkbox");
      if (cb) {
        cb.click();
        const input = cb.shadowRoot?.querySelector("input");
        if (input) {
          input.checked = true;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    })()`);
    await page.waitForTimeout(1000);
    await page.locator("oc-button[data-test='experience-save'] button").click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Click Next
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
  await nextBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await nextBtn.click({ force: true });
  await page.waitForTimeout(6000);

  console.log("On Page 2. Testing keyboard selection on autocompletes...");

  const acInputs = page.locator("spl-autocomplete input");
  const count = await acInputs.count();
  console.log("Autocomplete input count:", count);

  for (let i = 0; i < count; i++) {
    const inp = acInputs.nth(i);
    await inp.scrollIntoViewIfNeeded();
    await inp.click();
    await page.waitForTimeout(500);

    // Press ArrowDown then Enter
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    console.log(`Autocomplete ${i} selected value:`, await inp.inputValue());
  }

  await page.screenshot({ path: path.join(__dirname, "../screenshots/test_kb_select.png"), fullPage: true });
  console.log("Saved test_kb_select.png");

  await browser.close();
}

testKeyboardSelect().catch(console.error);
