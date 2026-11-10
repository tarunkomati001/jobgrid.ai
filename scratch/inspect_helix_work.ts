import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function inspectWorkEdu() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  // Let's navigate directly or test with the login
  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);
  await page.locator("a:has-text('Apply'), button:has-text('Apply')").first().click();
  await page.waitForTimeout(2000);

  // Fill email
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").first().click();
  await page.waitForTimeout(3000);

  // Step 2 -> Next
  await page.locator(".oracletaleocwsv2-arrow-nav-next").first().click();
  await page.waitForTimeout(3000);

  // Step 3 -> Next
  await page.locator(".oracletaleocwsv2-arrow-nav-next").first().click();
  await page.waitForTimeout(3000);

  console.log("Current step URL:", page.url(), "Title:", await page.title());

  // Click "Add Work History"
  const addWorkBtn = page.locator("button:has-text('Add Work History'), a:has-text('Add Work History')").first();
  if (await addWorkBtn.count() > 0) {
    console.log("Clicking Add Work History button...");
    await addWorkBtn.click();
    await page.waitForTimeout(2000);

    const workInputs = await page.evaluate(() => {
      const modal = document.querySelector(".modal, .dialog, [role='dialog'], form") || document.body;
      const inps = Array.from(modal.querySelectorAll("input, select, textarea"));
      return inps.filter(i => {
        const r = i.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).map(i => ({
        tagName: i.tagName,
        type: (i as any).type,
        name: (i as any).name,
        id: i.id,
        label: i.closest("div, p, label")?.querySelector("label")?.textContent?.trim() || ""
      }));
    });
    console.log("Work History inputs visible:", JSON.stringify(workInputs, null, 2));
    await page.screenshot({ path: "scratch/helix_add_work.png" });
  }

  await browser.close();
}

inspectWorkEdu().catch(console.error);

