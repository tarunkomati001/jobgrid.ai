import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function testStep2Popup() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742", { waitUntil: "networkidle" });

  // Step 1
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "u9m!LLvdS7Bcyqc");
  await page.fill("input[name='cwsPassword_2']", "u9m!LLvdS7Bcyqc");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(2000);

  // Step 2
  await page.fill("input[name='firstName']", "Hrutin");
  await page.fill("input[name='lastName']", "Nammi");
  await page.fill("input[name='phone']", "8688423267");
  await page.fill("input[name='address']", "Vadodara");
  await page.fill("input[name='city']", "Vadodara");
  await page.selectOption("select[name='state']", "California");
  await page.fill("input[name='zipCode']", "94105");
  await page.selectOption("select[name='source']", "1");
  await page.selectOption("select[name='legalStatus']", "441");
  await page.selectOption("select[name='CUSTOM_1237']", "1388");

  // Popup for Security Clearance
  console.log("Opening Security Clearance popup...");
  const popupBtn = page.locator("button[aria-label='Security Clearance']").first();
  await popupBtn.click();
  await page.waitForTimeout(1000);

  console.log("Selecting 'None' in popup...");
  const noneOpt = page.locator(".oracletaleocwsv2-multiselect-popup label:has-text('None')").first();
  await noneOpt.click();
  await page.waitForTimeout(500);

  console.log("Clicking Save in popup...");
  const saveBtn = page.locator(".oracletaleocwsv2-multiselect-popup a.oracletaleocwsv2-close-popup-trigger:has-text('Save')").first();
  await saveBtn.click();
  await page.waitForTimeout(1000);

  // Check input[name='CUSTOM_1136_total'] value
  const totalVal = await page.locator("input[name='CUSTOM_1136_total']").inputValue();
  console.log("CUSTOM_1136_total value is now:", totalVal);

  await page.selectOption("select[name='CUSTOM_1138']", "1386");
  await page.fill("textarea[name='CUSTOM_1140']", "N/A");
  await page.selectOption("select[name='CUSTOM_288']", "478");
  await page.fill("input[name='CUSTOM_1238']", "75000");
  await page.fill("input[name='CUSTOM_1239']", "95000");

  console.log("Clicking Next from Step 2...");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  const activeStep = await page.evaluate(() => {
    const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    const errors = Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text:not(:empty), .text-danger:not(:empty)")).map(e => e.textContent?.trim()).filter(Boolean);
    return {
      id: active ? active.id : null,
      title: active ? active.querySelector(".title")?.textContent?.trim() : null,
      errors
    };
  });

  console.log("Active step after Next:", JSON.stringify(activeStep, null, 2));

  await page.screenshot({ path: path.resolve(__dirname, "step2_to_step3_success.png") });

  await browser.close();
}

testStep2Popup().catch(console.error);
