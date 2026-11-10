import { chromium, Page } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import fs from "fs";
import path from "path";

async function selectRwOption(page: Page, widgetSelector: string, text: string) {
  const widget = page.locator(widgetSelector).first();
  if (await widget.count() === 0) return false;

  const widgetId = await widget.getAttribute("id") || "";
  await widget.scrollIntoViewIfNeeded().catch(() => {});
  await widget.click();
  await page.waitForTimeout(300);

  let opt = widgetId
    ? page.locator(`[id='${widgetId}__listbox'] li:has-text('${text}')`).first()
    : page.locator(`.rw-popup:visible li:has-text('${text}')`).first();

  if (await opt.count() === 0) {
    opt = page.locator(`li[role='option']:visible:has-text('${text}'), .rw-list-option:visible:has-text('${text}')`).first();
  }

  if (await opt.count() > 0) {
    await opt.click();
    console.log(`Selected "${text}" in ${widgetSelector}`);
    return true;
  }
  return false;
}

async function selectAddressState(page: Page, stateName: string) {
  const stateInput = page.locator("input[id='public-site-address-us-state']");
  if (await stateInput.count() === 0) return false;

  await stateInput.scrollIntoViewIfNeeded().catch(() => {});
  await stateInput.click({ force: true });
  await page.waitForTimeout(200);
  await stateInput.fill(stateName);
  await page.waitForTimeout(400);

  const option = page.locator(`div[class*='option']:visible:has-text('${stateName}'), div[id*='react-select']:visible:has-text('${stateName}')`).first();
  if (await option.count() > 0) {
    await option.click();
    return true;
  } else {
    await page.keyboard.press("Enter");
    return true;
  }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://recruiting.paylocity.com/Recruiting/jobs/Apply/3873766";
  console.log(`Navigating to ${url}...`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Cookie banner
  const cookieBtn = page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // 1. Uncheck fill out with resume
  const parseCheckbox = page.locator("input#useAttachedResumeToFillOutApplication");
  if (await parseCheckbox.count() > 0 && await parseCheckbox.isChecked()) {
    await parseCheckbox.uncheck().catch(() => {});
  }

  // 2. Upload resume
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  if (fs.existsSync(resumePath)) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null),
      page.locator("button[data-automation-id='btn-resume']").click().catch(() => {})
    ]);
    if (fileChooser) await fileChooser.setFiles(resumePath);
    await page.waitForTimeout(1500);
  }

  // Personal Info
  await page.locator("input[id='info.firstName']").fill("Hrutin");
  await page.locator("input[id='info.lastName']").fill("Nammi");
  await page.locator("input[id='info.preferredName']").fill("Hrutin");
  await page.locator("input[id='info.email']").fill("babufakemail@gmail.com");
  await page.locator("input[id='info.cellPhone']").fill("+12025550198");

  await selectRwOption(page, "[id='info.haveYouAppliedWithUsBefore']", "No");
  await selectRwOption(page, "[id='info.smsOptedIn']", "Yes");

  // Address
  await page.locator("input[id='public-site-address-address-1']").fill("123 Market St");
  await page.locator("input[id='public-site-address-city']").fill("San Francisco");
  await selectAddressState(page, "California");
  await page.locator("input[id='public-site-address-zip']").fill("94105");

  await page.locator("input[id='info.dateAvailableToStart']").fill("11/01/2026");

  // Salary
  await selectRwOption(page, "[id='info.desiredSalaryType']", "Annual");
  await page.locator("input[id='info.minimumDesiredSalary']").fill("95000");
  await page.locator("input[id='info.maximumDesiredSalary']").fill("115000");
  await page.locator("input[id='info.linkedIn']").fill("https://linkedin.com/in/hrutinnammi");

  const hearRadio = page.locator("label:has-text('Online Job Board')").first();
  if (await hearRadio.count() > 0) await hearRadio.click().catch(() => {});

  await selectRwOption(page, "[data-for*='worked with us before']", "No");

  // Click Next Step (Step 1 -> Step 2)
  console.log("Advancing to Step 2...");
  await page.locator("button#btn-submit, button:has-text('Next Step')").first().click();
  await page.waitForTimeout(5000);

  console.log("On Step 2. Answering additional questions...");
  // Answer US Citizen question: "Yes, I am a US Citizen"
  const citizenRadio = page.locator("label:has-text('Yes, I am a US Citizen'), input[value*='Citizen']").first();
  if (await citizenRadio.count() > 0) {
    await citizenRadio.click();
    console.log("Selected: Yes, I am a US Citizen");
  }

  // Screenshot Step 2 filled
  await page.screenshot({ path: "scratch/paylocity_step2_filled.png", fullPage: true });

  // Click Next Step (Step 2 -> Step 3)
  console.log("Clicking Next Step on Step 2...");
  await page.locator("button#btn-submit, button:has-text('Next Step')").first().click();
  await page.waitForTimeout(5000);

  const stepText = await page.locator("p:has-text('Step')").first().innerText().catch(() => "");
  console.log(`Current Step Status: "${stepText}"`);

  await page.screenshot({ path: "scratch/paylocity_step3.png", fullPage: true });
  console.log("Saved scratch/paylocity_step3.png");

  const step3Html = await page.content();
  fs.writeFileSync("scratch/paylocity_step3.html", step3Html);

  // Extract visible elements on Step 3
  const step3Elements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("input, select, textarea, button, h1, h2, h3, h4, p, label"));
    return all.map(el => ({
      tag: el.tagName,
      id: el.id,
      name: (el as any).name || "",
      text: (el.textContent || (el as any).value || "").trim().slice(0, 150),
      type: (el as any).type || "",
      visible: (el as HTMLElement).offsetParent !== null
    })).filter(e => e.visible);
  });

  fs.writeFileSync("scratch/paylocity_step3_elements.json", JSON.stringify(step3Elements, null, 2));
  console.log(`Step 3 visible elements: ${step3Elements.length}`);

  await browser.close();
}

run().catch(console.error);
