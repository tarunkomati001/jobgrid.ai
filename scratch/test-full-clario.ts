import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function setReactVal(page: any, selector: string, val: string) {
  const loc = page.locator(selector).first();
  await loc.focus();
  await loc.fill(val);
  await page.evaluate(({ sel, v }: any) => {
    const el = document.querySelector(sel) as HTMLInputElement;
    if (el) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(el, v);
      else el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, { sel: selector, v: val });
  await loc.blur();
}

async function testFullClario() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 850 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  console.log("Navigating to Clario...");
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  const applyBtn = p.locator("a[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(3000);

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume']").first();
  await autofillOption.click({ force: true });
  await p.waitForTimeout(4000);

  // Strictly click signInLink on the form
  console.log("Clicking button[data-automation-id='signInLink']...");
  const signInTab = p.locator("button[data-automation-id='signInLink']").first();
  await signInTab.click();
  await p.waitForTimeout(2000);

  console.log("Filling login credentials...");
  const workdayPassword = process.env.WORKDAY_PASSWORD || "Tarun@143";
  await setReactVal(p, "input[data-automation-id='email'], input[data-automation-id='userName']", "babufakemail@gmail.com");
  await setReactVal(p, "input[data-automation-id='password']", workdayPassword);

  console.log("Clicking Sign In button...");
  const signInBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
  await signInBtn.click();

  console.log("Waiting for wizard to mount...");
  await p.waitForFunction(() => {
    const url = window.location.href;
    if (url.includes("/login")) return false;
    return !!document.querySelector("input[type='file'], [data-automation-id='file-upload-drop-zone'], [data-automation-id='pageHeader']");
  }, { timeout: 25000 });

  console.log("Successfully reached application wizard! URL:", p.url());
  await p.screenshot({ path: "scratch/clario_wizard_ready.png" });

  // Now upload resume
  console.log("Uploading resume...");
  const fileInput = p.locator("input[type='file'], [data-automation-id='file-upload-drop-zone'] input").first();
  await fileInput.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await p.waitForTimeout(6000);

  // Click Continue to process resume parsing
  console.log("Clicking Continue after resume upload...");
  const continueBtn = p.locator("button[data-automation-id='bottom-navigation-next-button'], [data-automation-id='click_filter'][aria-label*='Continue']").last();
  await continueBtn.click();
  await p.waitForTimeout(8000);

  console.log("URL after resume continue:", p.url());
  await p.screenshot({ path: "scratch/clario_after_resume_continue.png" });

  await b.close();
}

testFullClario().catch(console.error);
