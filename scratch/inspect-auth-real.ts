import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  console.log("Navigating...");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Click Apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  console.log("Clicked Apply");
  await page.waitForTimeout(2000);

  // Click Autofill with Resume
  const autofillBtn = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill')").first();
  await autofillBtn.click({ force: true });
  console.log("Clicked Autofill");
  await page.waitForTimeout(5000);

  console.log("Auth Page URL:", page.url());

  const info = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button, a, div[role='button'], div[data-automation-id]"));
    return buttons.map(b => ({
      tag: b.tagName,
      id: b.id,
      automationId: b.getAttribute("data-automation-id"),
      ariaLabel: b.getAttribute("aria-label"),
      text: (b.textContent || "").trim().slice(0, 40)
    })).filter(x => x.text.toLowerCase().includes("create") || x.text.toLowerCase().includes("sign") || x.automationId);
  });

  console.log("Elements:\n", JSON.stringify(info, null, 2));
  await browser.close();
}

main().catch(console.error);
