import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND");
  
  // Click Apply
  const applyBtn = page.locator("button[data-automation-id='adventureButton']");
  await applyBtn.click();
  await page.waitForTimeout(2000);

  // Click Autofill with resume
  const autofillBtn = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']");
  await autofillBtn.click();
  await page.waitForTimeout(4000);

  // Switch to sign in if on create account
  const signInLink = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']");
  if (await signInLink.count() > 0) {
    await signInLink.click();
    await page.waitForTimeout(2000);
  }

  // Inspect submit buttons
  const buttonsHtml = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, div[data-automation-id='click_filter']"));
    return btns.map(b => ({
      tagName: b.tagName,
      id: b.id,
      automationId: b.getAttribute('data-automation-id'),
      ariaLabel: b.getAttribute('aria-label'),
      type: (b as HTMLButtonElement).type,
      text: b.textContent?.trim()
    })).filter(b => 
      (b.ariaLabel && (b.ariaLabel.includes('Sign') || b.ariaLabel.includes('Submit') || b.ariaLabel.includes('Log'))) ||
      (b.automationId && (b.automationId.includes('Sign') || b.automationId.includes('submit') || b.automationId.includes('Submit'))) ||
      (b.text && (b.text.includes('Sign In') || b.text.includes('Submit') || b.text.includes('Log In')))
    );
  });

  console.log("Submit-related buttons found in DOM:", JSON.stringify(buttonsHtml, null, 2));
  await browser.close();
}

main().catch(console.error);
