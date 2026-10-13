import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Madurai/Sr-Associate-I--Ocular-Health-Pharma-General-Field-Sales---Account-Management_R-2026-49856-1";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Apply -> Autofill with resume
  await page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first().click({ force: true });
  await page.waitForTimeout(2000);
  await page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first().click({ force: true });
  console.log("Clicked Autofill with resume, waiting for loading page to finish...");
  await page.waitForTimeout(10000);

  console.log("Current URL:", page.url());

  const dump = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input")).map(i => ({
      type: i.type,
      id: i.id,
      name: i.name,
      autoId: i.getAttribute("data-automation-id"),
      label: i.getAttribute("aria-label"),
      visible: (i as HTMLElement).offsetParent !== null
    }));

    const buttons = Array.from(document.querySelectorAll("button, [role='button']")).map(b => ({
      autoId: b.getAttribute("data-automation-id"),
      ariaLabel: b.getAttribute("aria-label"),
      text: (b.textContent || "").trim().slice(0, 30),
      visible: (b as HTMLElement).offsetParent !== null
    })).filter(b => b.visible);

    return { inputs, buttons };
  });

  console.log("INPUTS ON SCREEN:", JSON.stringify(dump.inputs, null, 2));
  console.log("BUTTONS ON SCREEN:", JSON.stringify(dump.buttons, null, 2));

  // Now switch to Sign In
  const signInBtn = page.locator("button[data-automation-id='signInLink']").first();
  if (await signInBtn.isVisible().catch(() => false)) {
    console.log("Found signInLink, clicking it...");
    await signInBtn.click({ force: true });
    await page.waitForTimeout(4000);
  }

  // Dump again after clicking Sign In
  const dump2 = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input")).map(i => ({
      type: i.type,
      id: i.id,
      name: i.name,
      autoId: i.getAttribute("data-automation-id"),
      visible: (i as HTMLElement).offsetParent !== null
    }));
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], div[data-automation-id='click_filter']")).map(b => ({
      autoId: b.getAttribute("data-automation-id"),
      ariaLabel: b.getAttribute("aria-label"),
      text: (b.textContent || "").trim().slice(0, 30),
      visible: (b as HTMLElement).offsetParent !== null
    })).filter(b => b.visible);
    return { inputs, buttons };
  });

  console.log("AFTER SIGN IN LINK CLICK - INPUTS:", JSON.stringify(dump2.inputs, null, 2));
  console.log("AFTER SIGN IN LINK CLICK - BUTTONS:", JSON.stringify(dump2.buttons, null, 2));

  await browser.close();
}

main().catch(console.error);
