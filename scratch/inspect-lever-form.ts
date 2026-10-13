import { chromium } from "playwright";

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log("Navigating to MoonPay apply page...");
  await page.goto("https://jobs.lever.co/moonpay/6e864b20-6e5b-4918-b0b5-a7ec5a3e65ca/apply", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const formDetails = await page.evaluate(() => {
    const form = document.querySelector("#application-form") as HTMLFormElement;
    const inputs = Array.from(document.querySelectorAll("input, button, iframe, textarea, select")).map(el => ({
      tag: el.tagName,
      name: (el as any).name || "",
      id: el.id || "",
      type: (el as any).type || "",
      required: (el as any).required || false
    }));

    // Find any captcha or anti-bot elements or verification elements
    const scripts = Array.from(document.querySelectorAll("script")).map(s => s.src).filter(Boolean);
    const captchaElements = Array.from(document.querySelectorAll("[class*='captcha'], [id*='captcha'], [name*='captcha'], iframe")).map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      src: (el as any).src || ""
    }));

    return {
      action: form?.action,
      method: form?.method,
      captchaElements,
      scripts: scripts.filter(s => s.includes("captcha") || s.includes("turnstile") || s.includes("arkose") || s.includes("lever")),
      inputsCount: inputs.length
    };
  });

  console.log("Form details:", JSON.stringify(formDetails, null, 2));
  await browser.close();
}

test().catch(console.error);
