import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const activeUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Software-Developer_R18300-1";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto(activeUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(4000);

  const applyManually = page.locator("a[data-automation-id='applyManually'], button[data-automation-id='applyManually'], [role='button']:has-text('Apply Manually')").first();
  if (await applyManually.count() > 0 && await applyManually.isVisible()) {
    await applyManually.click({ force: true });
  }

  await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName']", { timeout: 20000 });
  await page.waitForTimeout(2000);

  const testEmail = `babufakemail+clario${Date.now()}@gmail.com`;
  const testPw = "Tarun@2026!Aa";

  const hasVerifyPw = (await page.locator("input[data-automation-id='verifyPassword']").count()) > 0;
  if (!hasVerifyPw) {
    const createLink = page.locator("button[data-automation-id='createAccountLink'], a[data-automation-id='createAccountLink'], button:has-text('Create Account')").first();
    if (await createLink.count() > 0) {
      await createLink.click({ force: true });
      await page.waitForSelector("input[data-automation-id='verifyPassword']", { timeout: 10000 });
      await page.waitForTimeout(1000);
    }
  }

  await page.locator("input[data-automation-id='email']").first().fill(testEmail);
  await page.locator("input[data-automation-id='password']").first().fill(testPw);
  await page.locator("input[data-automation-id='verifyPassword']").first().fill(testPw);

  const cb = page.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox'], input[type='checkbox']").first();
  if (await cb.count() > 0 && !await cb.isChecked()) {
    await cb.check({ force: true });
  }

  const createBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Create Account'], button[data-automation-id='createAccountSubmitButton']").first();
  await createBtn.click({ force: true });
  await page.waitForTimeout(10000);

  // Close drawer
  const closeDrawer = page.locator("button[aria-label='Close'], button:has-text('✕')").first();
  if (await closeDrawer.count() > 0 && await closeDrawer.isVisible().catch(() => false)) {
    await closeDrawer.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Fast fill step 1
  const srcBtn = page.locator("button[data-automation-id*='source'], button[id*='source']").first();
  if (await srcBtn.count() > 0) {
    await srcBtn.click();
    await page.waitForTimeout(600);
    const opt = page.locator("[role='option']:has-text('LinkedIn'), [role='option']:has-text('Other')").first();
    if (await opt.count() > 0) await opt.click({ force: true });
    await page.waitForTimeout(400);
  }

  await page.locator("input[id*='firstName'], input[data-automation-id*='firstName']").first().fill("Hrutin");
  await page.locator("input[id*='lastName'], input[data-automation-id*='lastName']").first().fill("Nammi");
  await page.locator("input[id*='addressLine1']").first().fill("101 High Street");
  await page.locator("input[id*='city']").first().fill("Vadodara");
  await page.locator("input[id*='postalCode']").first().fill("390001");

  const phoneTypeBtn = page.locator("button[data-automation-id='phone-device-type'], button[id*='phone-device-type']").first();
  if (await phoneTypeBtn.count() > 0) {
    await phoneTypeBtn.click();
    await page.waitForTimeout(500);
    const mob = page.locator("[role='option']:has-text('Mobile')").first();
    if (await mob.count() > 0) await mob.click({ force: true });
    await page.waitForTimeout(300);
  }
  await page.locator("input[id*='phone-number'], input[data-automation-id='phone-number']").first().fill("8688423267");

  // Click Save and Continue
  await page.locator("button:has-text('Save and Continue')").last().click({ force: true });
  await page.waitForTimeout(6000);

  // Now analyze the sections on Step 2
  const sectionStructure = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h4"));
    return headings.map(h => {
      const sectionContainer = h.closest("div");
      // Find following sibling buttons or buttons inside this container or next sibling
      const parent = h.parentElement;
      const buttonsInside = Array.from(parent?.querySelectorAll("button") || []).map(b => b.textContent?.trim());
      return {
        heading: h.textContent?.trim(),
        parentTag: parent?.tagName,
        parentClass: parent?.className,
        parentDataAutoId: parent?.getAttribute("data-automation-id"),
        buttonsInside
      };
    });
  });

  console.log("Section structure for each h4:\n", JSON.stringify(sectionStructure, null, 2));

  // Let's click the Education Add button via XPath or JS evaluate
  console.log("Clicking Education Add button using JS...");
  const clickedEdu = await page.evaluate(() => {
    const h4s = Array.from(document.querySelectorAll("h4"));
    const eduH4 = h4s.find(h => h.textContent?.trim().toLowerCase() === "education");
    if (!eduH4) return false;
    // Find Add button in the same section or following container
    let container = eduH4.parentElement;
    while (container && !container.querySelector("button")) {
      container = container.parentElement;
    }
    const btn = container?.querySelector("button");
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("Clicked Education button:", clickedEdu);
  await page.waitForTimeout(2000);

  // Click Websites Add button via JS
  console.log("Clicking Websites Add button using JS...");
  const clickedWeb = await page.evaluate(() => {
    const h4s = Array.from(document.querySelectorAll("h4"));
    const webH4 = h4s.find(h => h.textContent?.trim().toLowerCase() === "websites");
    if (!webH4) return false;
    let container = webH4.parentElement;
    while (container && !container.querySelector("button")) {
      container = container.parentElement;
    }
    const btn = container?.querySelector("button");
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("Clicked Websites button:", clickedWeb);
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "scratch/clario_step2_all_cards_expanded.png", fullPage: true });

  // Dump all inputs and selectors inside all expanded cards
  const allCards = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("input, textarea, select, button[aria-haspopup]"));
    return all.map(el => ({
      tag: el.tagName,
      id: el.id,
      autoId: el.getAttribute("data-automation-id"),
      name: (el as HTMLInputElement).name,
      type: (el as HTMLInputElement).type,
      placeholder: (el as HTMLInputElement).placeholder,
      aria: el.getAttribute("aria-label"),
      closestH4: el.closest("div:has(> h4)")?.querySelector("h4")?.textContent?.trim() || el.closest("fieldset")?.querySelector("legend")?.textContent?.trim()
    }));
  });
  console.log("ALL CARDS ELEMENTS:\n", JSON.stringify(allCards, null, 2));

  await browser.close();
}

main().catch(console.error);
