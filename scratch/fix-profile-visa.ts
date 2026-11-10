import { createPersistentBrowserContext } from "../src/browser/browser-manager";
import { humanClick } from "../src/browser/form-filler";

async function fixProfileVisa() {
  console.log("Launching persistent browser context...");
  const context = await createPersistentBrowserContext(false);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log("Navigating to https://wellfound.com/profile/edit/preferences...");
  await page.goto("https://wellfound.com/profile/edit/preferences", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // 1. Set requireSponsorship to false
  console.log("Selecting 'requireSponsorship: false' (Do not require sponsorship)...");
  const noSponsorshipRadio = page.locator("#form-input--requireSponsorship--false, label:has-text('No') input[name='requireSponsorship']").first();
  if (await noSponsorshipRadio.isVisible()) {
    await noSponsorshipRadio.check({ force: true });
    console.log("✅ Checked requireSponsorship = false");
  } else {
    // Click label containing No near requireSponsorship
    await page.locator("label:has-text('No')").first().click();
  }

  // 2. Set usAuthorized to true
  console.log("Selecting 'usAuthorized: true' (Legally authorized to work in US)...");
  const usAuthorizedRadio = page.locator("#form-input--usAuthorized--true, label:has-text('Yes') input[name='usAuthorized']").first();
  if (await usAuthorizedRadio.isVisible()) {
    await usAuthorizedRadio.check({ force: true });
    console.log("✅ Checked usAuthorized = true");
  }

  // 3. Click Save button on preferences page
  console.log("Looking for Save button on preferences page...");
  const saveBtn = page.locator("button:has-text('Save'), button:has-text('Save changes'), input[type='submit'][value*='Save' i]").first();
  if (await saveBtn.isVisible()) {
    await humanClick(page, saveBtn);
    console.log("✅ Clicked Save button on preferences!");
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: "scratch/preferences_saved.png" });
  console.log("🎉 Profile Preferences updated!");
  await context.close();
}

fixProfileVisa().catch(console.error);

