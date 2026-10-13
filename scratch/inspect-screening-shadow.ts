import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function inspectScreeningQuestionsShadow() {
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

  // Deep inspect inside sr-screening-questions-form
  const screeningInfo = await page.evaluate(`(() => {
    const el = document.querySelector("sr-screening-questions-form") || document.querySelector("oc-screening-questions-form");
    if (!el) return { error: "not found" };

    const results = [];
    const queue = [el];
    while (queue.length > 0) {
      const curr = queue.shift();
      if (!curr) continue;
      if (curr.shadowRoot) {
        results.push({
          type: "SHADOW_ROOT_FOUND",
          tag: curr.tagName,
          childrenCount: curr.shadowRoot.children.length,
          htmlSample: curr.shadowRoot.innerHTML.slice(0, 300)
        });
        queue.push(...Array.from(curr.shadowRoot.children));
      }
      for (const child of curr.children || []) {
        queue.push(child);
      }
    }
    return results;
  })()`);

  console.log("Screening shadow info:", JSON.stringify(screeningInfo, null, 2));

  // Let's also check Playwright piercing locator on Page 2
  console.log("Playwright input count:", await page.locator("input").count());
  console.log("Playwright select count:", await page.locator("select").count());
  console.log("Playwright spl-autocomplete count:", await page.locator("spl-autocomplete").count());
  console.log("Playwright spl-radio-group count:", await page.locator("spl-radio-group").count());
  console.log("Playwright spl-checkbox count:", await page.locator("spl-checkbox").count());

  await browser.close();
}

inspectScreeningQuestionsShadow().catch(console.error);
