import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function inspectStep2Fields() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: DEFAULT_USER_AGENT });

  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);
  await page.locator("a:has-text('Apply'), button:has-text('Apply')").first().click();
  await page.waitForTimeout(2000);

  // Step 1: Register
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "Tarun@2006!Secure");
  await page.fill("input[name='cwsPassword_2']", "Tarun@2006!Secure");
  await page.locator(".oracletaleocwsv2-arrow-nav-next:visible").click();
  await page.waitForTimeout(3000);

  console.log("Current URL:", page.url(), "Title:", await page.title());

  const fields = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("input, select, textarea"));
    return els.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(el => {
      const parent = el.closest("div, p, label");
      const lbl = parent?.querySelector("label, .control-label, span.title, strong")?.textContent?.trim() || "";
      return {
        tag: el.tagName,
        type: (el as any).type,
        name: (el as any).name,
        id: el.id,
        required: (el as any).required || el.getAttribute("aria-required") === "true",
        label: lbl.replace(/\s+/g, " ")
      };
    });
  });

  console.log("Step 2 Fields:\n", JSON.stringify(fields, null, 2));
  await browser.close();
}

inspectStep2Fields().catch(console.error);
