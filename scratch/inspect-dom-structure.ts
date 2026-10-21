import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function inspectDOMStructure() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    const url = "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3";
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(4000);

    const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
    await page.waitForSelector("input[type='file']", { timeout: 15000 });
    await page.locator("input[type='file']").first().setInputFiles(resumePath);
    await page.waitForTimeout(8000);

    const confirmEmail = page.locator("spl-input#confirm-email-input input");
    if (await confirmEmail.count() > 0) await confirmEmail.fill("hrutinnammi8@gmail.com");

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
      const saveBtn = page.locator("oc-button[data-test='experience-save'] button");
      if (await saveBtn.count() > 0) {
        await saveBtn.click({ force: true });
        await page.waitForTimeout(2000);
      }
    }

    const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
    await nextBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await nextBtn.click({ force: true });
    await page.waitForTimeout(6000);

    // Let's check frames
    const frames = page.frames();
    console.log(`Page has ${frames.length} frames:`);
    for (const f of frames) {
      console.log(` - Frame URL: ${f.url()}, name: ${f.name()}`);
    }

    // Let's check all custom elements with shadow roots
    const shadowRoots = await page.evaluate(() => {
      const customTags: string[] = [];
      document.querySelectorAll("*").forEach(el => {
        if (el.shadowRoot) {
          customTags.push(el.tagName.toLowerCase());
        }
      });
      return customTags;
    });
    console.log("Elements with shadowRoot:", shadowRoots);

    // Let's check Playwright locators directly: Playwright automatically pierces shadow roots!
    console.log("Checking Playwright locators for Page 2:");
    console.log("spl-radio-group count:", await page.locator("spl-radio-group").count());
    console.log("spl-radio count:", await page.locator("spl-radio").count());
    console.log("spl-autocomplete count:", await page.locator("spl-autocomplete").count());
    console.log("spl-input count:", await page.locator("spl-input").count());
    console.log("spl-checkbox count:", await page.locator("spl-checkbox").count());
    console.log("input count:", await page.locator("input").count());

    // Print text of all questions
    const questionHeaders = await page.locator("h2, h3, h4, [class*='title'], [class*='question']").allInnerTexts();
    console.log("Question headers:", questionHeaders);

  } finally {
    await browser.close();
  }
}

inspectDOMStructure().catch(console.error);
