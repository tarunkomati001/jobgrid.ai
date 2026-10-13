import { chromium } from "playwright";

async function testAlcon() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  console.log("Navigating to Alcon...");
  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND");
  await p.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies'), button:has-text('Accept All')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await p.waitForTimeout(1000);
  }

  // Click Apply
  const applyBtn = p.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply'), button:has-text('Apply')").first();
  if (await applyBtn.count() > 0) {
    console.log("Clicking Apply button...");
    await applyBtn.click({ force: true });
    await p.waitForTimeout(3000);
  }

  // Click Autofill with Resume
  const autofillOption = p.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill with Resume')").first();
  if (await autofillOption.count() > 0) {
    console.log("Clicking Autofill with Resume...");
    await autofillOption.click({ force: true });
  }

  console.log("Waiting for auth inputs to load...");
  await p.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName'], input[type='email']", { timeout: 30000 });
  console.log("Auth inputs loaded! Current URL:", p.url());
  await p.screenshot({ path: "scratch/alcon_auth_screen_loaded.png" });

  const inputs = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, [data-automation-id='click_filter']")).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      label: el.getAttribute("aria-label"),
      type: (el as HTMLInputElement).type,
      text: (el as HTMLElement).innerText?.trim()?.slice(0, 30),
      visible: (el as HTMLElement).offsetParent !== null
    })).filter(x => x.visible);
  });
  console.log("Visible auth elements on Alcon:", JSON.stringify(inputs, null, 2));

  await b.close();
}

testAlcon().catch(console.error);
