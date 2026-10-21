import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5008");
  
  const adapter = new TaleoAdapter();
  await adapter.fillForm(page, {
    userId: "usr_hrutin_nammi",
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "8688423267",
    location: "ava street, vadodar, Gujarat, India",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi"
  }, {
    password: "Tarun@2006",
    resumePath: "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf"
  });

  const valid = await adapter.validate(page);
  console.log("Validation result:", valid);
  await page.screenshot({ path: "scratch/step1_fill_test.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
