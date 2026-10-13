import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectAddress() {
  const browser = await createBrowser(true);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://apply.workable.com/rokt/j/7219AFDA7F/apply/";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(() => {
    const addr = document.querySelector("input[name='address'], [data-ui='address'], #address");
    return {
      exists: !!addr,
      html: addr?.outerHTML,
      parentHtml: addr?.parentElement?.parentElement?.outerHTML?.slice(0, 1000)
    };
  });

  console.log("ADDRESS INFO:", res);
  await browser.close();
}

inspectAddress().catch(console.error);
