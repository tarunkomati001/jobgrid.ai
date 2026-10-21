import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";
import * as fs from "fs";

async function testLinkedInReal() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  console.log("1. Uploading real resume...");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);

  console.log("2. Waiting for resume parser...");
  await page.waitForTimeout(7000);

  // 3. Check for any incomplete experience edit form
  console.log("3. Handling experience edit form if open...");
  const cancelBtn = page.locator("[data-test='experience-cancel'] button, [data-test='experience-cancel']").first();
  if (await cancelBtn.count() > 0) {
    console.log("  Cancelling incomplete drafted experience entry...");
    await cancelBtn.scrollIntoViewIfNeeded().catch(() => {});
    await cancelBtn.click({ force: true }).catch(async () => {
      await page.evaluate(`(() => {
        const btn = document.querySelector("[data-test='experience-cancel']")?.querySelector("button") || document.querySelector("[data-test='experience-cancel']");
        if (btn) btn.click();
      })()`);
    });
    await page.waitForTimeout(1500);
  }

  // 4. Fill Confirm Email
  console.log("4. Filling Confirm Email...");
  const emailVal = await page.locator("spl-input#email-input input").inputValue().catch(() => "");
  console.log(`  Current email value: "${emailVal}"`);
  const confirmEmail = page.locator("spl-input#confirm-email-input input").first();
  await confirmEmail.fill(emailVal || "hrutinnammi8@gmail.com");

  // 5. Fill Profiles
  console.log("5. Filling Profiles...");
  await page.locator("spl-input#linkedin-input input").fill("https://www.linkedin.com/in/hrutinkumar");
  await page.locator("spl-input#website-input input").fill("https://github.com/hrutinkumar");

  // 6. Message to hiring team
  console.log("6. Filling Message...");
  await page.locator("spl-textarea#hiring-manager-message-input textarea").fill("I am very passionate about infrastructure engineering and would love to contribute to LinkedIn.");

  await page.waitForTimeout(1500);

  // 7. Click Next
  console.log("7. Clicking Next...");
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button, [data-test='footer-next'] button, button:has-text('Next')").first();
  await nextBtn.click();
  await page.waitForTimeout(5000);

  console.log("Current URL after Next:", page.url());

  const outDir = path.join(__dirname, "../screenshots");
  const shotPath = path.join(outDir, "linkedin_page2_real.png");
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

  fs.writeFileSync(path.join(outDir, "linkedin_page2_elements.json"), JSON.stringify(page2Structure, null, 2));

  await browser.close();
}

testLinkedInReal().catch(console.error);
