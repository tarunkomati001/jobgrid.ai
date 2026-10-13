import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function testRadioValidation() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  // Test on Sonatype first
  await page.goto("https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Find the Canada radio 'No'
  const radioNo = page.locator("input[type='radio'][value='No']").first();
  const labelNo = radioNo.locator("xpath=ancestor::label").first();
  console.log("Label count:", await labelNo.count());

  await labelNo.scrollIntoViewIfNeeded();
  await labelNo.click();
  await page.waitForTimeout(500);

  const check = await page.evaluate(() => {
    const r = document.querySelector("input[type='radio'][value='No']") as HTMLInputElement;
    return {
      checked: r?.checked,
      valid: r?.checkValidity(),
      validationMsg: r?.validationMessage
    };
  });

  console.log("Radio No check:", check);
  await browser.close();
}

testRadioValidation().catch(console.error);
