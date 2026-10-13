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
  
  // Wait 10 seconds for React components to fully mount
  console.log("Waiting 10s for step 1 components...");
  await page.waitForTimeout(10000);

  const frames = page.frames().map(f => f.url());
  console.log("Frames count:", frames.length, frames);

  const text = await page.evaluate(() => document.body.innerText);
  console.log("Page body text length:", text.length);
  console.log("Page body text snippet:\n", text);

  const inputTypes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input")).map(i => ({
      type: i.type,
      id: i.id,
      name: i.name,
      autoId: i.getAttribute("data-automation-id"),
      placeholder: i.placeholder,
      visible: (i as HTMLElement).offsetParent !== null
    }));
  });
  console.log("All inputs:", JSON.stringify(inputTypes, null, 2));

  await browser.close();
}

main().catch(console.error);
