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

  await page.waitForSelector("input[data-automation-id='email']", { timeout: 25000 });

  // Click Sign In link
  const signInBtn = page.locator("button[data-automation-id='signInLink']").first();
  await signInBtn.click({ force: true });
  console.log("Clicked signInLink, waiting 3s...");
  await page.waitForTimeout(3000);

  const allLinksOnSignIn = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, a")).map(b => ({
      tag: b.tagName,
      autoId: b.getAttribute("data-automation-id"),
      text: (b.textContent || "").trim(),
      ariaLabel: b.getAttribute("aria-label"),
      outerHTML: b.outerHTML.slice(0, 150)
    }));
  });

  console.log("All Links & Buttons on Sign In screen:\n", JSON.stringify(allLinksOnSignIn, null, 2));
  await browser.close();
}

main().catch(console.error);
