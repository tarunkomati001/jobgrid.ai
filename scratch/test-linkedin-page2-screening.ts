import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";
import * as fs from "fs";

async function testLinkedInPage2Screening() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to LinkedIn...");
  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(7000);

  // Close incomplete experience draft if open
  const cancelBtn = page.locator("oc-button[data-test='experience-cancel']");
  if (await cancelBtn.count() > 0) {
    await cancelBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await cancelBtn.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1000);
    }
  }

  // Fill Confirm Email
  const confirmEmail = page.locator("spl-input#confirm-email-input input").first();
  await confirmEmail.fill("hrutinnammi8@gmail.com");

  // Fill Profiles
  await page.locator("spl-input#linkedin-input input").fill("https://www.linkedin.com/in/hrutinkumar");
  await page.locator("spl-input#website-input input").fill("https://github.com/hrutinkumar");

  // Fill Message
  await page.locator("spl-textarea#hiring-manager-message-input textarea").fill("Excited about LinkedIn Web Infrastructure role.");

  await page.waitForTimeout(1000);

  // Click Next
  console.log("Clicking Next...");
  const nextBtn = page.locator("oc-button[data-test='footer-next']");
  await nextBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const nextBox = await nextBtn.boundingBox();
  if (nextBox) {
    await page.mouse.click(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2);
  }
  await page.waitForTimeout(5000);

  console.log("Current URL after Next:", page.url());

  const outDir = path.join(__dirname, "../screenshots");
  const shotPath = path.join(outDir, "linkedin_page2_inspected.png");
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
  console.log(`Saved ${page2Structure.length} elements to JSON`);

  await browser.close();
}

testLinkedInPage2Screening().catch(console.error);
