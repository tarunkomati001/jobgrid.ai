import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to Alcon...");
  await page.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND");
  await page.waitForTimeout(3000);

  // Click Apply -> Autofill with resume
  await page.locator("button[data-automation-id='adventureButton']").click();
  await page.waitForTimeout(2000);
  await page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").click();
  await page.waitForTimeout(3000);

  // Click Sign In tab
  const signInLink = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink'], div[data-automation-id='click_filter'][aria-label='Sign In']").first();
  console.log("Sign In tab count:", await signInLink.count());
  if (await signInLink.count() > 0) {
    await signInLink.click();
    await page.waitForTimeout(3000);
  }

  // Now inspect all links / buttons on this Sign In screen
  const elements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("button, a, div[role='button'], div[data-automation-id='click_filter']"));
    return all.map(el => ({
      tag: el.tagName,
      automationId: el.getAttribute('data-automation-id'),
      ariaLabel: el.getAttribute('aria-label'),
      text: el.textContent?.trim(),
      visible: (el as HTMLElement).offsetParent !== null
    })).filter(e => e.visible && (
      (e.text && (e.text.includes('Create') || e.text.includes('Sign') || e.text.includes('Account'))) ||
      (e.ariaLabel && (e.ariaLabel.includes('Create') || e.ariaLabel.includes('Sign'))) ||
      (e.automationId && (e.automationId.includes('create') || e.automationId.includes('Create')))
    ));
  });

  console.log("Visible Create/Sign elements on Sign In card:", JSON.stringify(elements, null, 2));
  await browser.close();
}

main().catch(console.error);
