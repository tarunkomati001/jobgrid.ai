import { chromium } from "playwright";
import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function diagnoseJobsSignup() {
  const context = await createPersistentBrowserContext(true);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log("Navigating to https://wellfound.com/jobs/signup...");
  await page.goto("https://wellfound.com/jobs/signup", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const url = page.url();
  const title = await page.title();
  console.log(`URL: ${url}`);
  console.log(`Title: ${title}`);

  const elements = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, button, a, form")).map(el => {
      const tag = el.tagName.toLowerCase();
      const text = el.textContent?.trim().slice(0, 100) || "";
      const type = el.getAttribute("type") || "";
      const name = el.getAttribute("name") || "";
      const id = el.id || "";
      const placeholder = el.getAttribute("placeholder") || "";
      const action = el.getAttribute("action") || "";
      const href = el.getAttribute("href") || "";
      return { tag, text, type, name, id, placeholder, action, href };
    });
    return inputs.filter(i => i.text || i.placeholder || i.name || i.id || i.type === 'submit');
  });

  console.log("Interactive elements on /jobs/signup:", JSON.stringify(elements, null, 2));
  await page.screenshot({ path: "scratch/diagnose_jobs_signup.png" });
  await context.close();
}

diagnoseJobsSignup().catch(console.error);

