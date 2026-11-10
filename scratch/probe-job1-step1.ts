import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import path from "path";
import fs from "fs";

async function probe() {
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

  console.log("Navigating to Job 1...");
  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Cookie dismiss
  const cookieBtn = page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // Remove backdrop
  await page.evaluate(() => {
    document.querySelectorAll(".backdrop, .modal-backdrop, #onetrust-consent-sdk, [id='0citrus-modal-wrapper']").forEach(el => el.remove());
    document.body.classList.remove("modal-open");
  });

  // Attach resume
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  console.log("Attaching resume...");
  await page.setInputFiles("input#btn-resume, input[type='file'][id*='resume']", resumePath);
  await page.waitForTimeout(2000);

  // Inspect all inputs, selects, and textareas on the page
  const elements = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, select, textarea, [role='combobox']"));
    return inputs.map(el => {
      const parent = el.closest(".form-group, fieldset, [class*='input'], [class*='control']");
      const label = parent ? (parent.querySelector("label, legend")?.textContent?.trim() || "") : "";
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || "",
        id: el.getAttribute("id") || "",
        name: el.getAttribute("name") || "",
        role: el.getAttribute("role") || "",
        dataFor: el.getAttribute("data-for") || "",
        label,
        value: (el as any).value || "",
        visible: (el as HTMLElement).offsetParent !== null
      };
    });
  });

  console.log(`Found ${elements.length} elements on Step 1:`);
  elements.forEach((el, i) => {
    console.log(`[${i+1}] ${el.tag} (id="${el.id}", name="${el.name}", type="${el.type}", vis=${el.visible}) Label: "${el.label}" Val: "${el.value}"`);
  });

  await browser.close();
}

probe().catch(console.error);
