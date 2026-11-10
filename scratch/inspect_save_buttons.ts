import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function inspectSaveButtons() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: DEFAULT_USER_AGENT });

  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);
  await page.locator("a:has-text('Apply'), button:has-text('Apply')").first().click();
  await page.waitForTimeout(2000);

  // Fill email
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").first().click();
  await page.waitForTimeout(2000);

  // Step 2
  await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select"));
    for (const s of selects) {
      if (s.options.length > 1) s.selectedIndex = 1;
    }
  });
  await page.locator(".oracletaleocwsv2-arrow-nav-next").first().click();
  await page.waitForTimeout(2000);

  // Step 3
  await page.locator(".oracletaleocwsv2-arrow-nav-next").first().click();
  await page.waitForTimeout(2000);

  console.log("On Step 4: Work and Education History");
  const addWorkBtn = page.locator("button:has-text('Add Work History'), a:has-text('Add Work History')").first();
  await addWorkBtn.click();
  await page.waitForTimeout(2000);

  const buttons = await page.evaluate(() => {
    const allBtns = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a"));
    return allBtns.filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(b => ({
      tag: b.tagName,
      text: b.textContent?.trim() || (b as any).value || "",
      id: b.id,
      className: b.className,
      onclick: b.getAttribute("onclick")
    }));
  });

  console.log("Visible clickable elements after clicking Add Work History:\n", JSON.stringify(buttons, null, 2));

  await browser.close();
}

inspectSaveButtons().catch(console.error);

