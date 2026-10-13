import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectField238() {
  const browser = await createBrowser(true);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://apply.workable.com/rokt/j/8C792C8AC9/apply/";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(() => {
    const el = document.querySelector("[name='QA_12406238']");
    return {
      outerHTML: el?.outerHTML,
      parent3: el?.parentElement?.parentElement?.parentElement?.outerHTML?.slice(0, 800)
    };
  });

  console.log("FIELD 238:\n", JSON.stringify(res, null, 2));
  await browser.close();
}

inspectField238().catch(console.error);
