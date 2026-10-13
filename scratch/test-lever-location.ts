import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function testSelectLocation() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Trigger location search and select
  const selected = await page.evaluate(async (city) => {
    const locInput = document.querySelector("input.location-input") as HTMLInputElement;
    const selectedLoc = document.querySelector("#selected-location") as HTMLInputElement;
    if (!locInput || !selectedLoc) return { success: false, reason: "inputs not found" };

    const hcaptcha = (document.querySelector("#hcaptchaResponseInput") as HTMLInputElement)?.value || "";
    const res = await fetch(`/searchLocations?text=${encodeURIComponent(city)}&hcaptchaResponse=${hcaptcha}`);
    if (!res.ok) return { success: false, reason: `fetch failed ${res.status}` };
    
    const locations = await res.json();
    if (!locations || !locations.length) return { success: false, reason: "no locations returned" };

    const match = locations[0];
    
    // Set values exactly as Lever's retrieveLocations.js does
    locInput.value = match.name;
    selectedLoc.value = JSON.stringify(match);

    // Dispatch input, change, and blur events
    locInput.dispatchEvent(new Event("input", { bubbles: true }));
    locInput.dispatchEvent(new Event("change", { bubbles: true }));

    // Also close any dropdown
    const container = document.querySelector(".dropdown-container") as HTMLElement;
    if (container) container.style.display = "none";

    return { success: true, location: match, val: locInput.value, selectedVal: selectedLoc.value };
  }, "Vadodara");

  console.log("Selected result:", selected);
  await page.waitForTimeout(2000);

  // Verify what page sees
  const currentVal = await page.inputValue("#location-input");
  const currentSelected = await page.inputValue("#selected-location");
  console.log("Verification from page:", { currentVal, currentSelected });

  await browser.close();
}

testSelectLocation().catch(console.error);
