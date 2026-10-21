import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectPhone() {
  const browser = await createBrowser(false);
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const phoneShadow = await page.evaluate(`(() => {
    const el = document.querySelector("spl-phone-field");
    return el && el.shadowRoot ? el.shadowRoot.innerHTML : "NO_SHADOW";
  })()`);

  console.log("spl-phone-field shadowRoot:\n", phoneShadow);
  await browser.close();
}

inspectPhone().catch(console.error);
