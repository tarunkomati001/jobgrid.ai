import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function testBrowserSearchLocations() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const res = await page.evaluate(async () => {
    try {
      const hcaptcha = (document.querySelector("#hcaptchaResponseInput") as HTMLInputElement)?.value || "";
      const r = await fetch(`/searchLocations?text=Vadodara&hcaptchaResponse=${hcaptcha}`);
      const status = r.status;
      const text = await r.text();
      return { status, text: text.slice(0, 500) };
    } catch (e: any) {
      return { error: e.message };
    }
  });

  console.log("In-page fetch searchLocations:", res);
  await browser.close();
}

testBrowserSearchLocations().catch(console.error);
