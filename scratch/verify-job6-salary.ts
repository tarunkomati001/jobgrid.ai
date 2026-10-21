import { chromium } from "playwright";
import { RecruiteeAdapter } from "../src/ats/recruitee/recruitee.adapter";

async function verify() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const a = new RecruiteeAdapter();
  await p.goto("https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new", { waitUntil: "domcontentloaded" });
  await a.fillForm(p, {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "2025550198",
    city: "San Francisco",
    state: "California"
  } as any);

  const isSalaryChecked = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input[name*='7631753']"))
      .filter((i: any) => i.checked)
      .map((i: any) => i.value);
  });

  console.log("Checked salary range on Job 6:", isSalaryChecked);
  await b.close();
}

verify().catch(console.error);
