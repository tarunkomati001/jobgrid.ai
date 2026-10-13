import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as fs from "fs";
import * as path from "path";

async function inspectFullForm(url: string, prefix: string) {
  console.log(`\n======================================================`);
  console.log(`Deep Inspecting: ${url}`);
  console.log(`======================================================`);

  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(4000);

  // Inspect all custom elements & form controls
  const page1Info = await page.evaluate(`(() => {
    const results = [];
    const queue = [document.body];
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) continue;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        const tag = el.tagName.toLowerCase();
        if (
          tag.startsWith("oc-") ||
          tag.startsWith("spl-") ||
          ["input", "select", "textarea", "button"].includes(tag)
        ) {
          results.push({
            tag,
            id: el.id,
            name: el.getAttribute("name"),
            formControlName: el.getAttribute("formcontrolname"),
            label: el.getAttribute("label") || el.getAttribute("aria-label"),
            dataTest: el.getAttribute("data-test"),
            required: el.hasAttribute("required"),
            text: el.innerText ? el.innerText.trim().slice(0, 100) : "",
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

  console.log(`Page 1 elements (${page1Info.length}):`);
  const relevantP1 = page1Info.filter(e => 
    e.tag.includes("input") || 
    e.tag.includes("textarea") || 
    e.tag.includes("select") || 
    e.tag.includes("autocomplete") || 
    e.tag.includes("phone") || 
    e.tag.includes("button") || 
    e.tag.includes("dropzone") ||
    e.formControlName
  );
  console.log(JSON.stringify(relevantP1, null, 2));

  // Let's test filling Page 1!
  console.log("\nAttempting to fill Page 1 fields...");

  // 1. First name
  const fnInput = page.locator("spl-input#first-name-input input, input#first-name-input");
  if (await fnInput.count() > 0) {
    await fnInput.fill("Tarun");
    console.log("  Filled First Name");
  }

  // 2. Last name
  const lnInput = page.locator("spl-input#last-name-input input, input#last-name-input");
  if (await lnInput.count() > 0) {
    await lnInput.fill("Kumar");
    console.log("  Filled Last Name");
  }

  // 3. Email
  const emailInput = page.locator("spl-input#email-input input, input#email-input");
  if (await emailInput.count() > 0) {
    await emailInput.fill("babufakemail@gmail.com");
    console.log("  Filled Email");
  }

  // 4. Confirm Email
  const confirmEmailInput = page.locator("spl-input#confirm-email-input input, input#confirm-email-input");
  if (await confirmEmailInput.count() > 0) {
    await confirmEmailInput.fill("babufakemail@gmail.com");
    console.log("  Filled Confirm Email");
  }

  // 5. City / Location
  // Check how spl-autocomplete works
  const cityAutocomplete = page.locator("spl-autocomplete input, oc-location-autocomplete input, [data-sr-id='location-autocomplete-search-root'] input");
  console.log(`  City input count: ${await cityAutocomplete.count()}`);
  if (await cityAutocomplete.count() > 0) {
    await cityAutocomplete.first().click();
    await cityAutocomplete.first().fill("San Francisco");
    await page.waitForTimeout(1500);
    // Look for dropdown items
    const options = await page.locator("spl-autocomplete-option, [role='option'], .c-spl-autocomplete-item, li").allInnerTexts().catch(() => []);
    console.log("  City options:", options.slice(0, 5));
    const firstOption = page.locator("spl-autocomplete-option, [role='option'], .c-spl-autocomplete-item").first();
    if (await firstOption.isVisible().catch(() => false)) {
      await firstOption.click();
      console.log("  Selected first city option");
    }
  }

  // 6. Phone number
  const phoneInput = page.locator("spl-phone-field input[type='tel'], spl-phone-field input, oc-phone-number input");
  console.log(`  Phone input count: ${await phoneInput.count()}`);
  if (await phoneInput.count() > 0) {
    await phoneInput.last().fill("5551234567");
    console.log("  Filled Phone");
  }

  // 7. Social Links
  const linkedin = page.locator("spl-input#linkedin-input input, input#linkedin-input");
  if (await linkedin.count() > 0) {
    await linkedin.fill("https://www.linkedin.com/in/tarunkumar");
    console.log("  Filled LinkedIn");
  }

  const website = page.locator("spl-input#website-input input, input#website-input");
  if (await website.count() > 0) {
    await website.fill("https://portfolio.example.com");
    console.log("  Filled Website");
  }

  // 8. Resume upload
  const fileInput = page.locator("input[type='file']");
  console.log(`  File input count: ${await fileInput.count()}`);
  if (await fileInput.count() > 0) {
    // Check if we have sample resume in repository
    const sampleResume = path.join(__dirname, "../storage/resumes/sample-resume.pdf");
    let testPdf = sampleResume;
    if (!fs.existsSync(sampleResume)) {
      // Find any pdf in workspace
      testPdf = path.join(__dirname, "test-resume.pdf");
      fs.writeFileSync(testPdf, "%PDF-1.4 ... dummy resume content");
    }
    await fileInput.first().setInputFiles(testPdf);
    console.log(`  Uploaded resume from: ${testPdf}`);
    await page.waitForTimeout(2000);
  }

  // Screenshot after filling Page 1
  const outDir = path.join(__dirname, "../screenshots");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${prefix}_page1_filled.png`), fullPage: true });

  // 9. Check Next button
  const nextBtn = page.locator("button:has-text('Next'), oc-button[data-test='footer-submit-button'] button, spl-button button:has-text('Next')");
  console.log(`  Next button count: ${await nextBtn.count()}`);
  if (await nextBtn.count() > 0) {
    console.log("  Clicking Next button...");
    await nextBtn.first().click();
    await page.waitForTimeout(4000);

    // Screenshot after Next
    await page.screenshot({ path: path.join(outDir, `${prefix}_page2.png`), fullPage: true });

    // Inspect Page 2 elements
    const page2Elements = await page.evaluate(`(() => {
      const results = [];
      const queue = [document.body];
      while (queue.length > 0) {
        const node = queue.shift();
        if (!node) continue;
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          const tag = el.tagName.toLowerCase();
          if (
            tag.startsWith("oc-") ||
            tag.startsWith("spl-") ||
            ["input", "select", "textarea", "button", "label"].includes(tag)
          ) {
            results.push({
              tag,
              id: el.id,
              name: el.getAttribute("name"),
              formControlName: el.getAttribute("formcontrolname"),
              label: el.getAttribute("label") || el.getAttribute("aria-label"),
              dataTest: el.getAttribute("data-test"),
              required: el.hasAttribute("required"),
              text: el.innerText ? el.innerText.trim().slice(0, 100) : "",
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

    console.log(`\nPage 2 elements (${page2Elements.length}):`);
    const relevantP2 = page2Elements.filter(e => 
      e.tag.includes("input") || 
      e.tag.includes("textarea") || 
      e.tag.includes("select") || 
      e.tag.includes("autocomplete") || 
      e.tag.includes("radio") ||
      e.tag.includes("checkbox") ||
      e.tag.includes("button") || 
      e.formControlName
    );
    console.log(JSON.stringify(relevantP2, null, 2));
  }

  await browser.close();
}

async function run() {
  await inspectFullForm("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", "sr_linkedin");
  await inspectFullForm("https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow", "sr_servicenow");
}

run().catch(console.error);
