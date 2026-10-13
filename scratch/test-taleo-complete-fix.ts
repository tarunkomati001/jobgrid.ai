import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5008";
  await page.goto(url, { waitUntil: "networkidle" });

  const applyBtn = page.locator("a:has-text('Apply Now'), button:has-text('Apply Now')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(3000);
  }

  // Login
  if (await page.locator("input[name='email']").count() > 0) {
    await page.fill("input[name='email']", "babufakemail@gmail.com");
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.fill("input[name='cwsPassword_2']", "Tarun@2006");
    await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
    await page.waitForTimeout(3000);
  }

  if (page.url().includes("candidateLogin")) {
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.locator("button[name='login'], button:has-text('Login')").first().click();
    await page.waitForTimeout(4000);
  }

  console.log("Current URL:", page.url());

  // Fill Step 1
  if (await page.locator("input[name='firstName']").count() > 0) {
    await page.fill("input[name='firstName']", "Hrutin");
  }
  // MIDDLE NAME
  if (await page.locator("input[name='middleInitial'], input[name*='middle' i], input[id*='middle' i]").count() > 0) {
    console.log("Filling Middle Name as Goud...");
    await page.fill("input[name='middleInitial'], input[name*='middle' i], input[id*='middle' i]", "Goud");
  }
  if (await page.locator("input[name='lastName']").count() > 0) {
    await page.fill("input[name='lastName']", "Nammi");
  }
  if (await page.locator("input[name='phone']").count() > 0) {
    await page.fill("input[name='phone']", "8688423267");
  }
  if (await page.locator("input[name='address']").count() > 0) {
    await page.fill("input[name='address']", "1/908 aaradhya, limda, wagodhiya");
  }
  if (await page.locator("input[name='city']").count() > 0) {
    await page.fill("input[name='city']", "Vadodara");
  }
  if (await page.locator("input[name='zipCode']").count() > 0) {
    await page.fill("input[name='zipCode']", "390144");
  }

  // Country and State
  // Check if select[name='country'] exists
  if (await page.locator("select[name='country']").count() > 0) {
    await page.selectOption("select[name='country']", { label: "India" }).catch(async () => {
      await page.selectOption("select[name='country']", "267").catch(() => {});
    });
    await page.waitForTimeout(500);
  }

  // Check state options now
  const stateInfo = await page.evaluate(() => {
    const sel = document.querySelector("select[name='state']") as HTMLSelectElement;
    if (!sel) return { exists: false, isVisible: false, val: "", options: [] };
    return {
      exists: true,
      isVisible: !!(sel.offsetWidth || sel.offsetHeight),
      val: sel.value,
      options: Array.from(sel.options).map(o => ({ text: o.text, value: o.value }))
    };
  });
  console.log("State info after country select:", JSON.stringify(stateInfo));

  if (stateInfo.exists) {
    // If state options are US states and "Gujarat" is not in there, what happens if we select California or inject Gujarat?
    // Let's check if the select allows custom option or requires one of the options
    await page.evaluate(() => {
      const sel = document.querySelector("select[name='state']") as HTMLSelectElement;
      if (sel) {
        // Check if Gujarat is there
        const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("gujarat") || o.value.toLowerCase().includes("gujarat"));
        if (opt) {
          sel.value = opt.value;
        } else {
          // If not in list, select California or first non-empty
          sel.value = "California";
        }
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  if (await page.locator("select[name='source']").count() > 0) {
    await page.selectOption("select[name='source']", "1").catch(() => {});
  }
  if (await page.locator("input[name='referredBy']").count() > 0) {
    await page.fill("input[name='referredBy']", "Direct Application").catch(() => {});
  }
  if (await page.locator("select[name='legalStatus']").count() > 0) {
    await page.selectOption("select[name='legalStatus']", "441").catch(() => {});
  }
  if (await page.locator("select[name='CUSTOM_1237']").count() > 0) {
    await page.selectOption("select[name='CUSTOM_1237']", "1388").catch(() => {});
  }

  // Security Clearance Multiselect popup
  const clearanceBtn = page.locator("button[aria-label='Security Clearance']").first();
  if (await clearanceBtn.count() > 0 && await clearanceBtn.isVisible()) {
    console.log("Setting Security Clearance: None...");
    await clearanceBtn.click();
    await page.waitForTimeout(500);
    const noneOpt = page.locator(".oracletaleocwsv2-multiselect-popup label:has-text('None')").first();
    if (await noneOpt.count() > 0) {
      await noneOpt.click();
      await page.waitForTimeout(300);
    }
    const savePopup = page.locator(".oracletaleocwsv2-multiselect-popup a.oracletaleocwsv2-close-popup-trigger:has-text('Save')").first();
    if (await savePopup.count() > 0) {
      await savePopup.click();
      await page.waitForTimeout(500);
    }
  }

  if (await page.locator("select[name='CUSTOM_1138']").count() > 0) {
    await page.selectOption("select[name='CUSTOM_1138']", "1386").catch(() => {});
  }
  if (await page.locator("textarea[name='CUSTOM_1140']").count() > 0) {
    await page.fill("textarea[name='CUSTOM_1140']", "N/A").catch(() => {});
  }
  if (await page.locator("select[name='CUSTOM_288']").count() > 0) {
    await page.selectOption("select[name='CUSTOM_288']", "478").catch(() => {});
  }
  if (await page.locator("input[name='CUSTOM_1238']").count() > 0) {
    await page.fill("input[name='CUSTOM_1238']", "75000").catch(() => {});
  }
  if (await page.locator("input[name='CUSTOM_1239']").count() > 0) {
    await page.fill("input[name='CUSTOM_1239']", "95000").catch(() => {});
  }

  // Now click Next arrow
  console.log("Clicking Next arrow...");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  // Check if errors exist or next step reached
  const res = await page.evaluate(() => {
    const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    const errors = Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text, .text-danger, .error, [class*='error']"))
      .map(e => (e as HTMLElement).innerText?.trim())
      .filter(t => t && t.length > 0 && !t.includes("Draft saved"));
    return {
      activeId: active?.id,
      title: active?.querySelector(".title, h1, h2")?.textContent?.trim(),
      errors
    };
  });

  console.log("Result after clicking next:", JSON.stringify(res, null, 2));
  await page.screenshot({ path: "scratch/taleo_after_step1_next_test.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
