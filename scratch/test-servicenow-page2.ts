import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as fs from "fs";
import * as path from "path";

async function testServiceNowPage2() {
  console.log("Navigating to ServiceNow...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  // 1. Upload resume first
  const testPdf = path.join(__dirname, "test-resume.pdf");
  if (!fs.existsSync(testPdf)) {
    fs.writeFileSync(testPdf, "%PDF-1.4 dummy");
  }
  const fileInput = page.locator("input[type='file']").first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(testPdf);
    await page.waitForTimeout(3000);
  }

  // 2. First name
  await page.locator("spl-input#first-name-input input").fill("Tarun");
  // 3. Last name
  await page.locator("spl-input#last-name-input input").fill("Kumar");
  // 4. Email
  await page.locator("spl-input#email-input input").fill("tarun.applicant@gmail.com");
  // 5. Confirm Email
  await page.locator("spl-input#confirm-email-input input").fill("tarun.applicant@gmail.com");

  // 6. City
  const cityInput = page.locator("spl-autocomplete input").first();
  await cityInput.click();
  await cityInput.fill("San Diego");
  await page.waitForTimeout(1500);
  await page.locator("[role='listbox'] [role='option'], .c-spl-autocomplete-item").first().click();

  // 7. Phone country code
  const countryTrigger = page.locator("spl-phone-field spl-select, spl-phone-field .c-spl-phone-field-selected").first();
  await countryTrigger.click();
  await page.waitForTimeout(500);
  const usOpt = page.locator("spl-select-option[value='US'], spl-select-option:has-text('United States')").first();
  if (await usOpt.count() > 0) {
    await usOpt.click();
  }
  // Phone number
  await page.locator("spl-phone-field input[type='tel']").first().fill("8585551234");

  // 8. Profiles
  await page.locator("spl-input#linkedin-input input").fill("https://www.linkedin.com/in/tarun-kumar");
  await page.locator("spl-input#website-input input").fill("https://tarun-portfolio.example.com");

  // 9. Message
  await page.locator("spl-textarea#hiring-manager-message-input textarea").fill("Excited about ServiceNow Data Platform role.");

  await page.waitForTimeout(1500);

  // 10. Click Next
  console.log("Clicking Next...");
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button, [data-test='footer-next'] button").first();
  await nextBtn.click();
  await page.waitForTimeout(5000);

  console.log("Current URL after Next:", page.url());

  // Take screenshot
  const outDir = path.join(__dirname, "../screenshots");
  const shotPath = path.join(outDir, "servicenow_page2_inspected.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("Screenshot saved to", shotPath);

  // Dump elements on Page 2
  const page2Structure = await page.evaluate(`(() => {
    const queue = [document.body];
    const results = [];
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) continue;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        const tag = el.tagName.toLowerCase();
        if (
          tag.startsWith("oc-") ||
          tag.startsWith("spl-") ||
          ["input", "select", "textarea", "button", "h1", "h2", "h3", "h4"].includes(tag)
        ) {
          results.push({
            tag,
            id: el.id,
            name: el.getAttribute("name"),
            formControlName: el.getAttribute("formcontrolname"),
            label: el.getAttribute("label") || el.getAttribute("aria-label"),
            dataTest: el.getAttribute("data-test"),
            type: (el).type,
            text: el.innerText ? el.innerText.trim().slice(0, 80) : ""
          });
        }
        if (el.shadowRoot) {
          queue.push(...Array.from(el.shadowRoot.childNodes));
        }
      }
      queue.push(...Array.from(node.childNodes));
    }
    return results;
  })()`);

  fs.writeFileSync(path.join(outDir, "servicenow_page2_elements.json"), JSON.stringify(page2Structure, null, 2));
  console.log(`Saved ${page2Structure.length} elements to JSON`);

  await browser.close();
}

testServiceNowPage2().catch(console.error);
