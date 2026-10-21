import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const c = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(c);
  const p = await c.newPage();

  console.log("Navigating to Medical-Imaging...");
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(4000);
  console.log("Final URL:", p.url());
  const bodyText = await p.innerText("body");
  console.log("Body text snippet:", bodyText.slice(0, 300));
  await p.screenshot({ path: "scratch/clario_medical_check.png" });

  console.log("Navigating to Software-Developer...");
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Software-Developer_R18300-1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(4000);
  console.log("Software Developer URL:", p.url());
  const devBody = await p.innerText("body");
  console.log("Software Developer text snippet:", devBody.slice(0, 300));
  await p.screenshot({ path: "scratch/clario_dev_check.png" });

  await b.close();
}

main().catch(console.error);
