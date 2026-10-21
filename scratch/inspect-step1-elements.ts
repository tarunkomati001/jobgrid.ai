import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Click Apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(2000);

  // Click Autofill with Resume
  const autofillBtn = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill')").first();
  await autofillBtn.click({ force: true });
  await page.waitForTimeout(4000);

  const inputsAndButtons = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll("input, button, a, [role='button'], [data-automation-id]"));
    return list.map(el => ({
      tag: el.tagName,
      type: el.getAttribute("type"),
      automationId: el.getAttribute("data-automation-id"),
      name: el.getAttribute("name"),
      id: el.id,
      ariaLabel: el.getAttribute("aria-label"),
      text: (el.textContent || "").trim().slice(0, 50)
    })).filter(x => x.automationId && !['header', 'logoLink', 'socialIcon'].includes(x.automationId));
  });

  console.log("Interactive form elements on Step 1 (Create Account/Sign In):", JSON.stringify(inputsAndButtons, null, 2));
  await browser.close();
}

main().catch(console.error);
