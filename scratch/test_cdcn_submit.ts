import { chromium } from "playwright";
import { getUserProfile } from "../src/database/user-profile.service";
import { AvatureAdapter } from "../src/ats/avature/avature.adapter";

async function main() {
  const profile = await getUserProfile("usr_hrutin_nammi");
  if (!profile) throw new Error("Profile not found");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const adapter = new AvatureAdapter();
    console.log("Navigating to CDCN job 8611...");
    await page.goto("https://cdcn.avature.net/careers/JobDetail/Software-Engineer-I/8611", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log("Running adapter.fillForm...");
    await adapter.fillForm(page, profile);
    console.log("Finished fillForm! Current URL:", page.url());
    await page.screenshot({ path: "scratch/cdcn_final_test.png", fullPage: true });
  } catch (err: any) {
    console.error("Error during execution:", err);
    await page.screenshot({ path: "scratch/cdcn_error_test.png", fullPage: true });
  } finally {
    await browser.close();
  }
}

main();
