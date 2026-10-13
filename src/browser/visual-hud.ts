import { Page, Frame, Locator, ElementHandle } from "playwright";

/**
 * Injects a modern, premium floating HUD (Heads-Up Display) into the page/frame.
 * Displays real-time status of the automated filling and submitting process.
 */
export async function injectVisualHUD(
  target: Page | Frame,
  options?: { company?: string; title?: string }
): Promise<void> {
  try {
    await target.evaluate(({ company, title }) => {
      const existing = document.getElementById("cluco-autopilot-hud");
      if (existing) return;

      // Create HUD container
      const hud = document.createElement("div");
      hud.id = "cluco-autopilot-hud";
      hud.setAttribute("style", `
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(59, 130, 246, 0.35);
        box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.5), 0 0 25px rgba(59, 130, 246, 0.25);
        color: #f8fafc;
        border-radius: 16px;
        padding: 16px 20px;
        min-width: 320px;
        max-width: 420px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        user-select: none;
      `);

      hud.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div id="cluco-hud-indicator" style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 10px #3b82f6; animation: cluco-pulse 1.8s infinite;"></div>
            <span style="font-weight: 700; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase; background: linear-gradient(135deg, #60a5fa 0%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              ⚡ CLUCO.AI AUTO-PILOT
            </span>
          </div>
          <span id="cluco-hud-badge" style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3);">
            AUTO-FILLING
          </span>
        </div>
        
        ${company ? `<div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Target: <strong style="color: #e2e8f0;">${company}</strong> ${title ? `— ${title}` : ''}</div>` : ''}
        
        <div id="cluco-hud-status" style="font-size: 13px; font-weight: 600; color: #ffffff; margin-bottom: 4px; line-height: 1.4;">
          Initializing AI auto-fill engine...
        </div>
        <div id="cluco-hud-detail" style="font-size: 11px; color: #94a3b8; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px;">
          Connecting to ATS form...
        </div>
        
        <div style="margin-top: 12px; height: 4px; background: rgba(255, 255, 255, 0.1); border-radius: 2px; overflow: hidden;">
          <div id="cluco-hud-progress" style="height: 100%; width: 15%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 2px; transition: width 0.4s ease;"></div>
        </div>
      `;

      // Add keyframes if not present
      if (!document.getElementById("cluco-hud-styles")) {
        const style = document.createElement("style");
        style.id = "cluco-hud-styles";
        style.textContent = `
          @keyframes cluco-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.6; }
          }
          .cluco-field-active {
            outline: 2px solid #3b82f6 !important;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.35) !important;
            transition: all 0.25s ease !important;
          }
          .cluco-field-success {
            outline: 2px solid #22c55e !important;
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.35) !important;
            transition: all 0.25s ease !important;
          }
          .cluco-field-error {
            outline: 2px solid #ef4444 !important;
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.35) !important;
            transition: all 0.25s ease !important;
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(hud);
    }, options || {});
  } catch (e) {
    // Non-blocking if frame is detached or navigating
  }
}

/**
 * Updates the HUD with current progress, step message, and detail.
 */
export async function updateHUDStatus(
  target: Page | Frame,
  status: string,
  detail?: string,
  type: "info" | "success" | "warning" | "error" | "submitting" = "info",
  progressPercent?: number
): Promise<void> {
  try {
    await target.evaluate(
      ({ status, detail, type, progressPercent }) => {
        const hud = document.getElementById("cluco-autopilot-hud");
        if (!hud) return;

        const statusEl = document.getElementById("cluco-hud-status");
        const detailEl = document.getElementById("cluco-hud-detail");
        const badgeEl = document.getElementById("cluco-hud-badge");
        const indicatorEl = document.getElementById("cluco-hud-indicator");
        const progressEl = document.getElementById("cluco-hud-progress");

        if (statusEl) statusEl.innerText = status;
        if (detailEl) detailEl.innerText = detail || "";

        if (progressEl && typeof progressPercent === "number") {
          progressEl.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
        }

        if (type === "success") {
          if (badgeEl) {
            badgeEl.innerText = "SUBMITTED";
            badgeEl.style.background = "rgba(34, 197, 94, 0.25)";
            badgeEl.style.color = "#86efac";
            badgeEl.style.borderColor = "rgba(34, 197, 94, 0.5)";
          }
          if (indicatorEl) {
            indicatorEl.style.background = "#22c55e";
            indicatorEl.style.boxShadow = "0 0 12px #22c55e";
          }
          if (progressEl) {
            progressEl.style.width = "100%";
            progressEl.style.background = "#22c55e";
          }
        } else if (type === "submitting") {
          if (badgeEl) {
            badgeEl.innerText = "SUBMITTING...";
            badgeEl.style.background = "rgba(168, 85, 247, 0.25)";
            badgeEl.style.color = "#d8b4fe";
            badgeEl.style.borderColor = "rgba(168, 85, 247, 0.5)";
          }
          if (indicatorEl) {
            indicatorEl.style.background = "#a855f7";
            indicatorEl.style.boxShadow = "0 0 12px #a855f7";
          }
        } else if (type === "error") {
          if (badgeEl) {
            badgeEl.innerText = "ERROR";
            badgeEl.style.background = "rgba(239, 68, 68, 0.25)";
            badgeEl.style.color = "#fca5a5";
            badgeEl.style.borderColor = "rgba(239, 68, 68, 0.5)";
          }
          if (indicatorEl) {
            indicatorEl.style.background = "#ef4444";
            indicatorEl.style.boxShadow = "0 0 12px #ef4444";
          }
        } else if (type === "warning") {
          if (badgeEl) {
            badgeEl.innerText = "DRY RUN";
            badgeEl.style.background = "rgba(234, 179, 8, 0.25)";
            badgeEl.style.color = "#fde047";
            badgeEl.style.borderColor = "rgba(234, 179, 8, 0.5)";
          }
          if (indicatorEl) {
            indicatorEl.style.background = "#eab308";
            indicatorEl.style.boxShadow = "0 0 12px #eab308";
          }
        }
      },
      { status, detail, type, progressPercent }
    );
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Highlights a target form container or input element in real-time.
 */
export async function highlightFieldElement(
  target: Page | Frame,
  locator: Locator,
  state: "active" | "success" | "error" = "active"
): Promise<void> {
  try {
    if (await locator.count() > 0) {
      // Scroll smoothly into view
      await locator.first().scrollIntoViewIfNeeded().catch(() => {});
      
      await locator.first().evaluate((el: HTMLElement, state) => {
        // Remove previous states
        el.classList.remove("cluco-field-active", "cluco-field-success", "cluco-field-error");
        el.classList.add(`cluco-field-${state}`);
      }, state);
    }
  } catch (e) {}
}

/**
 * Clears highlight on target element.
 */
export async function clearFieldHighlight(
  locator: Locator
): Promise<void> {
  try {
    if (await locator.count() > 0) {
      await locator.first().evaluate((el: HTMLElement) => {
        el.classList.remove("cluco-field-active", "cluco-field-success", "cluco-field-error");
      });
    }
  } catch (e) {}
}
