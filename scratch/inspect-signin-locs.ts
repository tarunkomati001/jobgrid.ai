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
  await page.waitForTimeout(6000);

  const signInInfo = await page.evaluate(() => {
    const textEls = Array.from(document.querySelectorAll("button, a, div[role='button']"));
    return textEls
      .filter(el => (el.textContent || "").includes("Sign In"))
      .map(el => ({
        tag: el.tagName,
        autoId: el.getAttribute("data-automation-id"),
        ariaLabel: el.getAttribute("aria-label"),
        parentClass: el.parentElement?.className,
        className: el.className,
        text: (el.textContent || "").trim()
      }));
  });

  console.log("Sign in links found:", JSON.stringify(signInInfo, null, 2));

  // Also check Create Account button
  const createAccBtn = await page.evaluate(() => {
    const textEls = Array.from(document.querySelectorAll("button, div[role='button'], [data-automation-id]"));
    return textEls
      .filter(el => (el.textContent || "").trim() === "Create Account")
      .map(el => ({
        tag: el.tagName,
        autoId: el.getAttribute("data-automation-id"),
        ariaLabel: el.getAttribute("aria-label"),
        text: (el.textContent || "").trim()
      }));
  });
  console.log("Create Account buttons found:", JSON.stringify(createAccBtn, null, 2));

  await browser.close();
}

main().catch(console.error);
