import { chromium } from "playwright";

async function inspectPasswordRules() {
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

  console.log("Before typing password, rules list HTML:");
  const rulesBefore = await p.evaluate(() => document.querySelector("[data-automation-id='passwordRulesList']")?.outerHTML);
  console.log(rulesBefore);

  console.log("Typing password...");
  const pwInput = p.locator("input[data-automation-id='password']").first();
  await pwInput.focus();
  await p.keyboard.type(pw, { delay: 50 });

  console.log("After typing password, rules list HTML:");
  const rulesAfter = await p.evaluate(() => document.querySelector("[data-automation-id='passwordRulesList']")?.outerHTML);
  console.log(rulesAfter);

  console.log("Now clicking button directly via mouse coordinate...");
  const createBtn = p.locator("button[data-automation-id='createAccountSubmitButton']").first();
  const box = await createBtn.boundingBox();
  console.log("Submit button box:", box);

  // Check what happens when clicking the div click_filter vs clicking button
  const filter = p.locator("div[data-automation-id='click_filter'][aria-label='Create Account']").first();
  const filterBox = await filter.boundingBox();
  console.log("Filter box:", filterBox);

  // Monitor network requests!
  p.on("request", req => {
    if (req.url().includes("create") || req.url().includes("login") || req.url().includes("apply") || req.method() === "POST") {
      console.log("Network POST request:", req.method(), req.url());
    }
  });
  p.on("response", async res => {
    if (res.url().includes("create") || res.url().includes("login") || res.url().includes("apply")) {
      console.log("Network response:", res.status(), res.url());
      try {
        const text = await res.text();
        console.log("Response body preview:", text.slice(0, 200));
      } catch {}
    }
  });

  // Also fill verify password
  await p.locator("input[data-automation-id='email']").fill(email);
  await p.locator("input[data-automation-id='verifyPassword']").fill(pw);

  console.log("Triggering mouse click on filter box center...");
  if (filterBox) {
    await p.mouse.click(filterBox.x + filterBox.width / 2, filterBox.y + filterBox.height / 2);
  }

  await p.waitForTimeout(5000);

  console.log("Now triggering click on actual button element...");
  await p.evaluate(() => {
    const btn = document.querySelector("button[data-automation-id='createAccountSubmitButton']") as HTMLButtonElement;
    btn?.click();
  });

  await p.waitForTimeout(5000);

  await b.close();
}

inspectPasswordRules().catch(console.error);
