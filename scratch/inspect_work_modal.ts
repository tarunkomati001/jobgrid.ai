import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function inspectWorkModalButtons() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: DEFAULT_USER_AGENT });

  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);
  await page.locator("a:has-text('Apply'), button:has-text('Apply')").first().click();
  await page.waitForTimeout(2000);

  // Step 1: Register
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.locator(".oracletaleocwsv2-arrow-nav-next:visible").click();
  await page.waitForTimeout(2000);

  // Step 2: Information
  await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select"));
    for (const s of selects) if (s.options.length > 1) s.selectedIndex = 1;
    const inps = Array.from(document.querySelectorAll("input[type='text']:not([readonly])")) as HTMLInputElement[];
    for (const i of inps) if (!i.value) i.value = "Test";
  });
  await page.locator(".oracletaleocwsv2-arrow-nav-next:visible").click();
  await page.waitForTimeout(2000);

  // Step 3: Resume
  await page.locator(".oracletaleocwsv2-arrow-nav-next:visible").click();
  await page.waitForTimeout(2000);

  console.log("Active step URL:", page.url(), "Title:", await page.title());

  // Click Add Work History
  const addWork = page.locator("a.oracletaleocwsv2-add-work-trigger:visible, button:has-text('Add Work History'):visible").first();
  await addWork.click();
  await page.waitForTimeout(1500);

  const modalButtons = await page.evaluate(() => {
    const titleInp = document.getElementById("WORK_HISTORY_jobTitle");
    if (!titleInp) return { error: "titleInp not found" };

    const parent = titleInp.closest(".modal-content, .modal, form, div[id*='work'], div[class*='work']") || titleInp.parentElement?.parentElement?.parentElement?.parentElement;
    if (!parent) return { error: "parent not found" };

    const clickable = Array.from(parent.querySelectorAll("button, input[type='button'], input[type='submit'], a"));
    return {
      parentTag: parent.tagName,
      parentId: parent.id,
      parentClass: parent.className,
      buttons: clickable.map(b => ({
        tag: b.tagName,
        text: b.textContent?.trim() || (b as any).value || "",
        id: b.id,
        className: b.className,
        type: (b as any).type
      }))
    };
  });

  console.log("Modal inspection result:\n", JSON.stringify(modalButtons, null, 2));
  await browser.close();
}

inspectWorkModalButtons().catch(console.error);

