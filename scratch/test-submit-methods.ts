import { chromium } from "playwright";

async function testSubmitMethods() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  const applyBtn = p.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(3000);

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  await autofillOption.click({ force: true });

  await p.waitForSelector("input[data-automation-id='email']", { timeout: 30000 });

  const email = "babufakemail@gmail.com";
  const pw = "ClucoAi@2026!Secure";

  // Check how input values are set: standard fill vs native prototype vs typing
  console.log("Typing values slowly like human...");
  await p.locator("input[data-automation-id='email']").click();
  await p.keyboard.type(email, { delay: 30 });

  await p.locator("input[data-automation-id='password']").click();
  await p.keyboard.type(pw, { delay: 30 });

  await p.locator("input[data-automation-id='verifyPassword']").click();
  await p.keyboard.type(pw, { delay: 30 });

  await p.waitForTimeout(1000);

  // Check if button is enabled or disabled
  const btnState = await p.evaluate(() => {
    const btn = document.querySelector("button[data-automation-id='createAccountSubmitButton']") as HTMLButtonElement;
    const filter = document.querySelector("div[data-automation-id='click_filter'][aria-label='Create Account']") as HTMLElement;
    const form = document.querySelector("form[data-automation-id='signInFormo'], form") as HTMLFormElement;
    return {
      btnDisabled: btn?.disabled,
      btnAriaDisabled: btn?.getAttribute("aria-disabled"),
      btnClass: btn?.className,
      btnTabIndex: btn?.tabIndex,
      filterClass: filter?.className,
      formAction: form?.action
    };
  });
  console.log("Button state:", JSON.stringify(btnState, null, 2));

  // Now press Enter on verifyPassword input OR click button
  console.log("Pressing Enter on verifyPassword...");
  await p.keyboard.press("Enter");

  console.log("Waiting 6s after Enter...");
  await p.waitForTimeout(6000);
  console.log("URL after Enter:", p.url());
  await p.screenshot({ path: "scratch/alcon_after_enter.png", fullPage: true });

  // If still on same page, click button directly via DOM dispatch
  const stillOnAuth = p.url().includes("autofillWithResume") && (await p.locator("input[data-automation-id='verifyPassword']").count() > 0);
  if (stillOnAuth) {
    console.log("Still on Create Account page. Trying form.requestSubmit()...");
    await p.evaluate(() => {
      const form = document.querySelector("form[data-automation-id='signInFormo'], form") as HTMLFormElement;
      if (form) {
        if (form.requestSubmit) form.requestSubmit();
        else form.submit();
      }
    });
    await p.waitForTimeout(6000);
    console.log("URL after form.requestSubmit():", p.url());
    await p.screenshot({ path: "scratch/alcon_after_form_submit.png", fullPage: true });
  }

  await b.close();
}

testSubmitMethods().catch(console.error);
