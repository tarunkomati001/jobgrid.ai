import { chromium, Browser, BrowserContext, Page } from "playwright";
import path from "path";
import { injectPopupSuppression } from "./popup-handler";

// Ensure Windows System32 is present in PATH so taskkill and native utils can be invoked by Playwright
if (process.platform === "win32") {
  const sys32 = "C:\\Windows\\System32";
  const win = "C:\\Windows";
  const curPath = process.env.PATH || "";
  const toAdd = [sys32, win].filter(p => !curPath.toLowerCase().includes(p.toLowerCase()));
  if (toAdd.length > 0) {
    process.env.PATH = `${toAdd.join(";")};${curPath}`;
  }
}

export const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function applyStealthScripts(context: BrowserContext): Promise<void> {
  // Inject automatic popup and cookie banner suppression
  await injectPopupSuppression(context);

  await context.addInitScript(() => {
    // 1. Cleanly delete and override webdriver from navigator prototype & instance
    try {
      const proto = Object.getPrototypeOf(navigator);
      delete (proto as any).webdriver;
      Object.defineProperty(proto, 'webdriver', {
        get: () => false,
        configurable: true,
      });
      delete (navigator as any).webdriver;
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true,
      });
    } catch (e) {}

    // 2. Mock realistic Chrome object and runtime properties for anti-bot detectors
    try {
      if (!(window as any).chrome) {
        (window as any).chrome = {};
      }
      const chrome = (window as any).chrome;
      if (!chrome.app) {
        chrome.app = { isInstalled: false, InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" }, RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" } };
      }
      if (!chrome.runtime) {
        chrome.runtime = {
          OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
          OnRestartRequiredReason: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
          PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
          PlatformNaclArch: { ARM: "arm", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
          PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
          RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" },
          connect: function () {},
          sendMessage: function () {},
        };
      }
      if (!chrome.loadTimes) {
        chrome.loadTimes = function () {
          return {
            commitLoadTime: Date.now() / 1000 - 0.5,
            connectionInfo: "h2",
            finishDocumentLoadTime: Date.now() / 1000 - 0.1,
            finishLoadTime: Date.now() / 1000,
            firstPaintAfterLoadTime: 0,
            firstPaintTime: Date.now() / 1000 - 0.4,
            navigationType: "Other",
            requestTime: Date.now() / 1000 - 0.8,
            startLoadTime: Date.now() / 1000 - 0.7,
            wasAlternateProtocolAvailable: false,
            wasFetchedViaSpdy: true,
            wasNpnNegotiated: true
          };
        };
      }
      if (!chrome.csi) {
        chrome.csi = function () {
          return { startE: Date.now() - 800, onloadT: Date.now(), pageT: 800, tran: 15 };
        };
      }
    } catch (e) {}

    // 3. Ensure permissions query behaves realistically
    try {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters && parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as any) :
          originalQuery(parameters)
      );
    } catch (e) {}

    // 4. WebGL Vendor & Renderer override to match standard hardware GPUs (NVIDIA/Intel)
    try {
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
        // UNMASKED_VENDOR_WEBGL
        if (parameter === 37445) {
          return "Google Inc. (NVIDIA)";
        }
        // UNMASKED_RENDERER_WEBGL
        if (parameter === 37446) {
          return "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)";
        }
        return getParameter.apply(this, [parameter]);
      };
    } catch (e) {}

    // 5. Mock plugins, languages, hardware for reCAPTCHA telemetry without breaking prototype checks
    try {
      const dummyPlugin = {
        name: "PDF Viewer",
        filename: "internal-pdf-viewer",
        description: "Portable Document Format",
        length: 1,
        item: function () { return null; },
        namedItem: function () { return null; }
      };
      const dummyPlugins = [dummyPlugin];
      (dummyPlugins as any).item = function (index: number) { return dummyPlugins[index] || null; };
      (dummyPlugins as any).namedItem = function (name: string) { return dummyPlugins.find(p => p.name === name) || null; };
      (dummyPlugins as any).refresh = function () {};

      Object.defineProperty(navigator, 'plugins', { get: () => dummyPlugins });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    } catch (e) {}
  });
}

/**
 * Creates and launches a Playwright Microsoft Edge Browser instance.
 * Falls back to default Chromium if Microsoft Edge binary channel is unavailable.
 */
export async function createBrowser(headless: boolean = false): Promise<Browser> {
  const slowMo = process.env.PLAYWRIGHT_SLOWMO ? parseInt(process.env.PLAYWRIGHT_SLOWMO, 10) : 120;
  console.log(`🚀 Launching Google Chrome Browser (channel: chrome, headless: ${headless}, slowMo: ${slowMo}ms)...`);
  const launchOptions = {
    headless,
    slowMo,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process,EnablePasswordGeneration",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-size=1280,850"
    ],
  };

  try {
    return await chromium.launch({
      channel: "chrome",
      ...launchOptions
    });
  } catch (err) {
    console.warn("⚠️ Google Chrome channel not available. Launching standard Chromium browser instead.");
    return await chromium.launch(launchOptions);
  }
}

/**
 * Creates and launches a Persistent Browser Context with stored cookies, session cache,
 * and user history. This significantly lowers anti-bot risk scores (Cloudflare / hCaptcha),
 * preventing interactive visual challenges ("Tap on things...").
 */
export async function createPersistentBrowserContext(
  headless: boolean = false,
  customProfileDir?: string
): Promise<BrowserContext> {
  const profileDir = customProfileDir || path.resolve(process.cwd(), ".chrome-profile");
  const slowMo = process.env.PLAYWRIGHT_SLOWMO ? parseInt(process.env.PLAYWRIGHT_SLOWMO, 10) : 120;
  console.log(`🚀 Launching Persistent Chrome Context (profile: ${profileDir}, headless: ${headless}, slowMo: ${slowMo}ms)...`);

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless,
    slowMo,
    viewport: { width: 1280, height: 850 },
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process,EnablePasswordGeneration",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-size=1280,850"
    ],
  });

  await applyStealthScripts(context);
  return context;
}

/**
 * Helper to open a page, execute an action, and ensure browser cleanup.
 */
export async function withBrowserPage<T>(
  action: (page: Page, context: BrowserContext) => Promise<T>,
  options: { headless?: boolean } = {}
): Promise<T> {
  const headless = options.headless !== undefined ? options.headless : false;
  const browser = await createBrowser(headless);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "America/New_York",
  });
  
  // Apply anti-bot stealth scripts
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    return await action(page, context);
  } finally {
    console.log("🧹 Closing page, context, and browser...");
    await page.close();
    await context.close();
    await browser.close();
  }
}

/**
 * Generates a valid PDF from a plain text resume content using Playwright.
 */
export async function generateResumePdf(filePath: string, textContent: string): Promise<void> {
  const lines = textContent.split("\n").map(l => l.trim()).filter(Boolean);
  const name = lines[0] || "Resume";
  const contactInfo = lines[1] || "";
  const links = lines[2] || "";
  const remainingLines = lines.slice(3);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${name} - Resume</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          margin: 40px;
          color: #333;
          line-height: 1.6;
          font-size: 14px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        h1 {
          margin: 0 0 5px 0;
          font-size: 28px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .contact, .links {
          margin: 5px 0;
          font-size: 12px;
          color: #666;
        }
        .content {
          margin-top: 20px;
        }
        .section {
          margin-bottom: 20px;
        }
        .section-title {
          font-weight: bold;
          font-size: 16px;
          border-bottom: 1px solid #ddd;
          margin-bottom: 10px;
          padding-bottom: 3px;
          text-transform: uppercase;
        }
        p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${name}</h1>
        <div class="contact">${contactInfo}</div>
        <div class="links">${links}</div>
      </div>
      <div class="content">
        ${remainingLines.map(line => {
          if (line.toLowerCase().startsWith("skills:") || line.toLowerCase().startsWith("education:") || line.toLowerCase().startsWith("experience:")) {
            return `
              <div class="section">
                <div class="section-title">${line.split(":")[0]}</div>
                <p>${line.split(":").slice(1).join(":")}</p>
              </div>
            `;
          }
          return `<p>${line}</p>`;
        }).join("")}
      </div>
    </body>
    </html>
  `;

  await withBrowserPage(async (page) => {
    await page.setContent(html);
    await page.pdf({
      path: filePath,
      format: "A4",
      margin: {
        top: "0.4in",
        right: "0.4in",
        bottom: "0.4in",
        left: "0.4in"
      }
    });
  }, { headless: true });
}

