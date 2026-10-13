import { chromium } from "playwright";

async function testLeverLive() {
  const url = "https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply";
  console.log("Testing Lever job URL:", url);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("Status:", resp?.status());
  console.log("Title:", await page.title());
  
  const hasForm = await page.$(".application-form, #application-form, form");
  console.log("Has application form:", !!hasForm);
  
  const submitBtn = await page.$("#btn-submit, button[type='submit']");
  console.log("Has submit button:", !!submitBtn);

  const hcaptchaEl = await page.$("[data-sitekey], iframe[src*='hcaptcha'], #hcaptchaResponseInput");
  console.log("Has hCaptcha element:", !!hcaptchaEl);
  
  await browser.close();
}

testLeverLive().catch(console.error);
