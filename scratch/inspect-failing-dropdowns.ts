/**
 * Inspect specific dropdown options that are failing
 */

import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectSpecificDropdowns() {
  console.log("🔍 Inspecting specific failing dropdowns...\n");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://job-boards.greenhouse.io/vercel/jobs/5798416004", { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2000);

  const targets = [
    { id: "question_15376455004", label: "Based in these countries?", search: "" },
    { id: "question_15376463004", label: "Privacy Notice", search: "" },
    { id: "question_15376464004", label: "Double-check info", search: "" },
  ];

  for (const t of targets) {
    console.log(`\n📋 ${t.label} (#${t.id}):`);
    
    const combobox = page.locator(`#${t.id}`);
    await combobox.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);

    // Open dropdown via control click
    await page.evaluate((id: string) => {
      const input = document.getElementById(id);
      if (!input) return;
      let el: HTMLElement | null = input;
      while (el && !el.classList.contains("select__control")) el = el.parentElement;
      if (el) {
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    }, t.id);
    await combobox.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);

    // Get aria-controls
    const listboxId = await page.evaluate((id: string) => {
      const inp = document.getElementById(id);
      return inp?.getAttribute("aria-controls") || "NONE";
    }, t.id);
    console.log(`  aria-controls: ${listboxId}`);

    // Get all options from the listbox
    if (listboxId !== "NONE") {
      const opts = page.locator(`#${listboxId} [role="option"]`);
      const count = await opts.count();
      console.log(`  Options in listbox (${count}):`);
      for (let i = 0; i < count; i++) {
        const text = (await opts.nth(i).innerText().catch(() => "")).trim();
        console.log(`    ${i+1}. "${text}"`);
      }
    }

    // Also try visible menu
    const visibleOpts = page.locator(".select__menu:visible [role='option']");
    const vCount = await visibleOpts.count();
    console.log(`  Visible menu options (${vCount}):`);
    for (let i = 0; i < vCount; i++) {
      const text = (await visibleOpts.nth(i).innerText().catch(() => "")).trim();
      console.log(`    ${i+1}. "${text}"`);
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(2000);
  await browser.close();
}

inspectSpecificDropdowns().catch(console.error);
