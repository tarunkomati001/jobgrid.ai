import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import * as fs from "fs";

async function main() {
  const b = await chromium.launch({ headless: true });
  const c = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(c);
  const p = await c.newPage();

  console.log("Navigating...");
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(4000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    console.log("Clicking cookie notice...");
    await cookieBtn.click();
    await p.waitForTimeout(1000);
  }

  const applyBtn = p.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first();
  console.log("Clicking Apply button...");
  await applyBtn.click({ force: true });
  await p.waitForTimeout(3000);

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  if (await autofillOption.count() > 0 && await autofillOption.isVisible()) {
    console.log("Clicking Autofill with Resume option...");
    await autofillOption.click({ force: true });
    await p.waitForTimeout(5000);
  }

  await p.screenshot({ path: "scratch/clario_auth_modal_screen.png", fullPage: true });

  const modalInfo = await p.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, select, textarea")).map(el => ({
      tag: el.tagName,
      id: el.id,
      autoId: el.getAttribute("data-automation-id"),
      name: (el as HTMLInputElement).name,
      type: (el as HTMLInputElement).type,
      ariaLabel: el.getAttribute("aria-label"),
      visible: (el as HTMLElement).offsetParent !== null
    }));

    const buttons = Array.from(document.querySelectorAll("button, a, div[data-automation-id='click_filter'], [role='button']")).map(el => ({
      tag: el.tagName,
      id: el.id,
      autoId: el.getAttribute("data-automation-id"),
      ariaLabel: el.getAttribute("aria-label"),
      text: el.textContent?.trim()?.slice(0, 50),
      visible: (el as HTMLElement).offsetParent !== null
    })).filter(b => b.text || b.autoId || b.ariaLabel);

    return { url: window.location.href, inputs, buttons };
  });

  console.log("Modal Info:", JSON.stringify(modalInfo, null, 2));
  fs.writeFileSync("scratch/clario_auth_modal.json", JSON.stringify(modalInfo, null, 2));

  await b.close();
}

main().catch(console.error);
