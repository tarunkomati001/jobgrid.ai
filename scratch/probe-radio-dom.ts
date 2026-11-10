import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function probeRadio() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const radioDom = await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll("input[type='radio']"));
    return radios.map(r => ({
      name: r.getAttribute("name"),
      value: r.getAttribute("value"),
      outerHTML: r.parentElement?.outerHTML
    }));
  });

  console.log("Radio DOM snippets:", JSON.stringify(radioDom.slice(0, 3), null, 2));
  await browser.close();
}

probeRadio().catch(console.error);
