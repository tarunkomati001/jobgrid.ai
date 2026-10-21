import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1/apply/autofillWithResume";
  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Check what links / buttons are available on initial screen
  const initialElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, a, input")).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      text: el.textContent?.trim(),
      type: (el as any).type,
      ariaLabel: el.getAttribute("aria-label")
    }));
  });
  console.log("Initial auth elements:", JSON.stringify(initialElements, null, 2));

  // Try clicking Sign In link
  const signInLoc = page.locator("[data-automation-id='signInLink'], a:has-text('Sign In'), button:has-text('Sign In')").first();
  console.log("signInLoc count:", await signInLoc.count());
  if (await signInLoc.count() > 0) {
    console.log("Clicking Sign In link...");
    await signInLoc.click({ force: true });
    await page.waitForTimeout(3000);
  }

  const afterSignInClick = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, a, input")).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      text: el.textContent?.trim(),
      type: (el as any).type,
      ariaLabel: el.getAttribute("aria-label")
    }));
  });
  console.log("Elements after clicking Sign In:", JSON.stringify(afterSignInClick, null, 2));

  await browser.close();
}

main().catch(console.error);
