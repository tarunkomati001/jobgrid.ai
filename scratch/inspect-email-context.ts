import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(2000);

  const autofillBtn = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill')").first();
  await autofillBtn.click({ force: true });

  console.log("Waiting for input[data-automation-id='email']...");
  await page.waitForSelector("input[data-automation-id='email']", { timeout: 25000 });
  console.log("Found email input!");

  const elementsAround = await page.evaluate(() => {
    const emailInput = document.querySelector("input[data-automation-id='email']")!;
    const container = emailInput.closest("div[class*='css-']")?.parentElement?.parentElement || document.body;
    const buttons = Array.from(container.querySelectorAll("button, a, div[data-automation-id]"));
    return buttons.map(b => ({
      tag: b.tagName,
      autoId: b.getAttribute("data-automation-id"),
      ariaLabel: b.getAttribute("aria-label"),
      text: (b.textContent || "").trim()
    }));
  });

  console.log("Elements around email input:\n", JSON.stringify(elementsAround, null, 2));
  await browser.close();
}

main().catch(console.error);
