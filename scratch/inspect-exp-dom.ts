import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectExperienceInputs() {
  const browser = await createBrowser(false);
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const expAddBtn = page.locator("oc-experience [data-test='add-experience'] button, oc-experience button:has-text('Add')").first();
  await expAddBtn.click();
  await page.waitForTimeout(1000);

  const expHtml = await page.evaluate(`(() => {
    const el = document.querySelector("oc-experience");
    return el ? el.innerHTML : "NOT_FOUND";
  })()`);

  console.log("oc-experience HTML:\n", expHtml);
  await browser.close();
}

inspectExperienceInputs().catch(console.error);
