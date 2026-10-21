import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectLocationJs() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const loc = document.querySelector("#location-input") as HTMLInputElement;
    const scripts = Array.from(document.querySelectorAll("script")).map(s => s.src).filter(Boolean);
    const hiddenSelectedLoc = document.querySelector("#selected-location") as HTMLInputElement;
    
    // Check if there is any global object like google, lever, Places, etc.
    const globals = {
      hasGoogle: !!(window as any).google,
      hasLever: !!(window as any).lever,
      hasPlaces: !!((window as any).google?.maps?.places),
      inputAttrs: loc ? Array.from(loc.attributes).map(a => `${a.name}="${a.value}"`) : [],
      hiddenAttrs: hiddenSelectedLoc ? Array.from(hiddenSelectedLoc.attributes).map(a => `${a.name}="${a.value}"`) : []
    };

    return { globals, scripts: scripts.slice(0, 15) };
  });

  console.log("Inspect JS:", JSON.stringify(info, null, 2));
  await browser.close();
}

inspectLocationJs().catch(console.error);
