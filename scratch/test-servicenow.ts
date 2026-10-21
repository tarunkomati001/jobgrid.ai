import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function testServiceNow() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to ServiceNow...");
  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow", { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(5000);

  const title = await page.title();
  console.log("Page title:", title);
  console.log("Page URL:", page.url());

  const hasVerification = await page.locator("text=Verification Required").count().catch(() => 0);
  console.log("Verification text detected:", hasVerification);

  const splInputs = await page.locator("spl-input").count();
  console.log("spl-input count:", splInputs);

  await browser.close();
}

testServiceNow().catch(console.error);
