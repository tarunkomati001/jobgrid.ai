import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function inspectStepSwitching() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  // Inspect the wizard steps header
  const wizardNav = await page.evaluate(() => {
    // Check all step headers
    const stepHeaders = Array.from(document.querySelectorAll("[class*='step'], [id*='step']")).filter(el => {
      return el.classList.contains("oracletaleocwsv2-step") || el.id.startsWith("step-") || el.classList.contains("stepId");
    }).map(el => ({
      id: el.id,
      className: el.className,
      text: el.textContent?.trim().slice(0, 100),
      onclick: el.getAttribute("onclick"),
      style: el.getAttribute("style"),
      display: window.getComputedStyle(el).display,
      visibility: window.getComputedStyle(el).visibility
    }));

    // Check wizard progress bar or buttons
    const navItems = Array.from(document.querySelectorAll(".oracletaleocwsv2-step-navigation, .wizard-steps, .wizard, .steps")).map(el => ({
      className: el.className,
      innerHtml: el.innerHTML.slice(0, 300)
    }));

    return {
      stepHeaders,
      navItems
    };
  });

  console.log("Wizard Steps & Nav:", JSON.stringify(wizardNav, null, 2));

  // Let's also check if there are buttons that move to next step
  // Let's check all visible buttons or anchors in #step-01
  const step1Buttons = await page.evaluate(() => {
    const s1 = document.getElementById("step-01");
    if (!s1) return [];
    return Array.from(s1.querySelectorAll("button, a, input[type='button'], input[type='submit']")).map(b => ({
      tag: b.tagName,
      id: b.id,
      text: b.textContent?.trim(),
      className: b.className,
      onclick: b.getAttribute("onclick")
    }));
  });

  console.log("Step 1 buttons:", JSON.stringify(step1Buttons, null, 2));

  // Check parent of step-01
  const parentInfo = await page.evaluate(() => {
    const s1 = document.getElementById("step-01");
    if (!s1 || !s1.parentElement) return null;
    return {
      parentTag: s1.parentElement.tagName,
      parentId: s1.parentElement.id,
      parentClass: s1.parentElement.className,
      siblings: Array.from(s1.parentElement.children).map(c => ({
        tag: c.tagName,
        id: c.id,
        className: c.className
      }))
    };
  });
  console.log("Parent & Siblings:", JSON.stringify(parentInfo, null, 2));

  await browser.close();
}

inspectStepSwitching().catch(console.error);
