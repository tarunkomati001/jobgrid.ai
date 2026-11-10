import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import fs from "fs";

async function dumpStep1Inputs() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048";
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  // Cookie dismiss
  const cookieBtn = page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Dump all inputs
  const allInputs = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll("input, select, textarea, div.rw-dropdownlist, div[role='combobox']"));
    return list.map(el => {
      const id = el.id || "";
      const name = (el as any).name || "";
      const dataFor = el.getAttribute("data-for") || "";
      const formGroup = el.closest(".form-group, .card, fieldset");
      const parentLabel = formGroup?.querySelector("label, legend")?.textContent?.trim() || "";
      const tagName = el.tagName.toLowerCase();
      const type = (el as any).type || el.getAttribute("role") || tagName;
      const placeholder = (el as any).placeholder || "";
      const val = (el as any).value || el.textContent?.trim() || "";
      const required = (el as any).required || el.getAttribute("aria-required") === "true" || parentLabel.includes("required");
      return { id, name, dataFor, parentLabel, tagName, type, placeholder, val, required };
    });
  });

  fs.writeFileSync("scratch/job1_step1_all_inputs.json", JSON.stringify(allInputs, null, 2));
  console.log(`Saved ${allInputs.length} inputs to scratch/job1_step1_all_inputs.json`);

  // Also check buttons on the page (like Add Education, Add Work Experience, Next Step)
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, a.btn")).map(b => ({
      text: b.textContent?.trim(),
      id: b.id,
      automationId: b.getAttribute("data-automation-id"),
      className: b.className
    }));
  });
  console.log("Buttons found:", buttons);

  await browser.close();
}

dumpStep1Inputs().catch(console.error);
