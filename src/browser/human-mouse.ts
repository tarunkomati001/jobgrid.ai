import { Page, Frame, Locator } from "playwright";

export interface Point {
  x: number;
  y: number;
}

export interface MouseMoveOptions {
  /** Target duration in milliseconds (default dynamic based on distance) */
  durationMs?: number;
  /** Frequency of zig-zag waves along the path (default: 3 to 6) */
  oscillations?: number;
  /** Maximum amplitude perpendicular offset in pixels (default: dynamic 6-18px) */
  amplitude?: number;
  /** Magnitude of high-frequency tremor (default: 1.2px) */
  tremor?: number;
  /** Whether to simulate slight overshoot and correction at the end (default: true) */
  overshoot?: boolean;
}

// Global page coordinate tracker to avoid teleportation
const pageMousePosition = new WeakMap<Page, Point>();

/**
 * Ensures the virtual cursor overlay is injected for visual inspection in headed mode.
 * Suppresses the browser's native static cursor so only ONE authentic cursor is visible moving in zig-zag.
 */
export async function injectCursorVisualizer(target: Page | Frame): Promise<void> {
  const page = "mouse" in target ? target : (target as Frame).page();
  try {
    await page.evaluate(() => {
      // Suppress native OS cursor over document while automation is active
      document.documentElement.classList.add("cluco-automated-cursor");

      // Add styles for cursor suppression and hardware-accelerated movement
      if (!document.getElementById("cluco-cursor-style")) {
        const style = document.createElement("style");
        style.id = "cluco-cursor-style";
        style.textContent = `
          /* Hide static browser cursor during automation so user sees ONLY ONE smooth cursor */
          html,
          body,
          html *,
          body *,
          html input,
          html button,
          html a,
          html select,
          html textarea {
            cursor: none !important;
          }

          #cluco-virtual-cursor {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 24px !important;
            height: 24px !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
            transition: none !important;
            will-change: transform !important;
            display: block !important;
          }

          .cluco-click-pulse svg {
            animation: cluco-click-ripple 0.28s ease-out forwards;
          }
          @keyframes cluco-click-ripple {
            0% { transform: scale(1); }
            40% { transform: scale(0.82) translate(1px, 1px); }
            75% { transform: scale(1.18) translate(-1px, -1px); }
            100% { transform: scale(1); }
          }
        `;
        document.head.appendChild(style);
      }

      let cursor = document.getElementById("cluco-virtual-cursor");
      if (!cursor) {
        cursor = document.createElement("div");
        cursor.id = "cluco-virtual-cursor";
        // Pixel-perfect Windows 10/11 system arrow cursor SVG with tip precisely at (0, 0)
        cursor.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(1px 2px 4px rgba(0,0,0,0.6));">
            <path d="M0 0 L0 18.5 L4.8 13.7 L8.5 21 L10.8 19.8 L7.2 12.6 L14.2 12.6 Z" fill="#000000" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
        `;
        document.body.appendChild(cursor);
      } else {
        cursor.style.display = "block";
      }
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Cleanly removes cursor suppression and hides the virtual cursor.
 * Restores 100% native cursor control to the user when automation finishes or pauses for review / CAPTCHA.
 */
export async function removeCursorVisualizer(target: Page | Frame): Promise<void> {
  const page = "mouse" in target ? target : (target as Frame).page();
  try {
    await page.evaluate(() => {
      document.documentElement.classList.remove("cluco-automated-cursor");
      const c = document.getElementById("cluco-virtual-cursor");
      if (c) {
        c.style.display = "none";
      }
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Updates the visual cursor position on screen using hardware-accelerated transforms.
 * Auto-injects the visual cursor element if not already present on page.
 */
async function updateVisualCursor(page: Page, x: number, y: number, isClick = false): Promise<void> {
  try {
    await page.evaluate(({ cx, cy, click }) => {
      let c = document.getElementById("cluco-virtual-cursor");
      if (!c) {
        if (!document.getElementById("cluco-cursor-style")) {
          const style = document.createElement("style");
          style.id = "cluco-cursor-style";
          style.textContent = `
            html, body, html *, body * {
              cursor: none !important;
            }
            #cluco-virtual-cursor {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 26px !important;
              height: 26px !important;
              pointer-events: none !important;
              z-index: 2147483647 !important;
              transition: none !important;
              will-change: transform !important;
              display: block !important;
            }
            .cluco-click-pulse svg {
              animation: cluco-click-ripple 0.28s ease-out forwards;
            }
            @keyframes cluco-click-ripple {
              0% { transform: scale(1); }
              40% { transform: scale(0.82) translate(1px, 1px); }
              75% { transform: scale(1.22) translate(-1px, -1px); }
              100% { transform: scale(1); }
            }
          `;
          document.head?.appendChild(style);
        }

        c = document.createElement("div");
        c.id = "cluco-virtual-cursor";
        c.innerHTML = `
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(1px 2px 5px rgba(0,0,0,0.75));">
            <path d="M0 0 L0 18.5 L4.8 13.7 L8.5 21 L10.8 19.8 L7.2 12.6 L14.2 12.6 Z" fill="#000000" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
          </svg>
        `;
        (document.body || document.documentElement)?.appendChild(c);
      }

      if (c) {
        c.style.display = "block";
        c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        if (click) {
          c.classList.remove("cluco-click-pulse");
          void c.offsetWidth; // Trigger reflow
          c.classList.add("cluco-click-pulse");
        }
      }
    }, { cx: Math.round(x), cy: Math.round(y), click: isClick }).catch(() => {});
  } catch (e) {}
}

/**
 * Gets or initializes the current mouse position.
 */
export function getCurrentMousePosition(page: Page): Point {
  const current = pageMousePosition.get(page);
  if (current) return current;
  const initial = { x: 150 + Math.random() * 200, y: 150 + Math.random() * 200 };
  pageMousePosition.set(page, initial);
  return initial;
}

/**
 * Sets current mouse position in memory.
 */
export function setCurrentMousePosition(page: Page, point: Point): void {
  pageMousePosition.set(page, point);
}

/**
 * Calculates a natural human graphic zig-zag trajectory between two points.
 * Combines:
 * 1. Cubic Bezier curve (curved natural hand arc)
 * 2. Multi-frequency sinusoidal zig-zag wave modulation
 * 3. Micro-tremor biological hand jitter
 * 4. Fitts's law sigmoidal velocity easing (slow start, rapid transit, gentle deceleration)
 * 5. Dynamic overshoot & settle correction
 */
export function generateZigZagPath(
  start: Point,
  end: Point,
  options: MouseMoveOptions = {}
): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 3) {
    return [{ ...end }];
  }

  // Determine step resolution based on distance (dense enough for smooth physics telemetry)
  const steps = Math.max(16, Math.min(100, Math.floor(distance / 7) + 12));

  // Perpendicular unit vector (normal to travel direction)
  const nx = -dy / distance;
  const ny = dx / distance;

  // 1. Arc curvature control points for Cubic Bezier backbone
  const arcSign = Math.random() > 0.5 ? 1 : -1;
  const arcDev1 = arcSign * (Math.random() * 0.25 + 0.1) * distance;
  const arcDev2 = arcSign * (Math.random() * 0.2 + 0.05) * distance;

  const cp1: Point = {
    x: start.x + dx * 0.32 + nx * arcDev1,
    y: start.y + dy * 0.32 + ny * arcDev1,
  };
  const cp2: Point = {
    x: start.x + dx * 0.68 + nx * arcDev2,
    y: start.y + dy * 0.68 + ny * arcDev2,
  };

  // 2. Zig-zag oscillation parameters (pronounced, organic, visible trajectory)
  const oscillations = options.oscillations ?? (4 + Math.floor(Math.random() * 3)); // 4 to 6 waves
  const maxAmplitude = options.amplitude ?? Math.min(38, Math.max(16, distance * 0.12));
  const phaseShift = Math.random() * Math.PI * 2;
  const tremorStrength = options.tremor ?? 1.6;

  // 3. Overshoot target if enabled and distance is substantial (> 60px)
  let overshootOffset: Point = { x: 0, y: 0 };
  if (options.overshoot !== false && distance > 60 && Math.random() > 0.25) {
    const overshootDist = 2 + Math.random() * 4;
    overshootOffset = {
      x: (dx / distance) * overshootDist,
      y: (dy / distance) * overshootDist,
    };
  }

  const path: Point[] = [];

  for (let i = 0; i <= steps; i++) {
    // Normal progress [0..1]
    const linearT = i / steps;

    // Fitts's Law easing profile: Sigmoid / smooth cubic S-curve
    // Progress starts slow, accelerates through the middle, decelerates near target
    const easeT = linearT < 0.5
      ? 4 * linearT * linearT * linearT
      : 1 - Math.pow(-2 * linearT + 2, 3) / 2;

    // Cubic Bezier base point
    const u = 1 - easeT;
    const bx = u * u * u * start.x + 3 * u * u * easeT * cp1.x + 3 * u * easeT * easeT * cp2.x + easeT * easeT * easeT * end.x;
    const by = u * u * u * start.y + 3 * u * u * easeT * cp1.y + 3 * u * easeT * easeT * cp2.y + easeT * easeT * easeT * end.y;

    // Envelope function: smooth sinusoidal window so wave starts at 0, peaks mid-flight, ends at 0
    const envelope = Math.sin(Math.PI * easeT);

    // Zig-zag waveform: primary harmonic + secondary sub-harmonic for organic complexity
    const wave1 = Math.sin(2 * Math.PI * oscillations * easeT + phaseShift);
    const wave2 = 0.35 * Math.sin(4 * Math.PI * oscillations * easeT + phaseShift * 1.5);
    const combinedWave = (wave1 + wave2) / 1.35;

    const zigzagOffset = combinedWave * maxAmplitude * envelope;

    // Biological high-frequency hand tremor (Brownian jitter)
    const jitterX = (Math.random() - 0.5) * tremorStrength;
    const jitterY = (Math.random() - 0.5) * tremorStrength;

    // Slight overshoot influence on the last 15% of movement
    let ox = 0;
    let oy = 0;
    if (easeT > 0.82 && easeT < 0.96) {
      const overshootWeight = Math.sin(((easeT - 0.82) / 0.14) * Math.PI);
      ox = overshootOffset.x * overshootWeight;
      oy = overshootOffset.y * overshootWeight;
    }

    path.push({
      x: bx + nx * zigzagOffset + jitterX + ox,
      y: by + ny * zigzagOffset + jitterY + oy,
    });
  }

  // Ensure exact final endpoint with micro-settle
  path.push({ ...end });
  return path;
}

/**
 * Smoothly moves the Playwright mouse using human-like graphic zig-zag trajectories.
 */
export async function humanMouseMove(
  target: Page | Frame,
  targetX: number,
  targetY: number,
  options: MouseMoveOptions = {}
): Promise<void> {
  const page = "mouse" in target ? target : (target as Frame).page();
  const current = getCurrentMousePosition(page);
  const endPoint: Point = { x: targetX, y: targetY };

  const dx = endPoint.x - current.x;
  const dy = endPoint.y - current.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 2) {
    await page.mouse.move(targetX, targetY);
    setCurrentMousePosition(page, endPoint);
    await updateVisualCursor(page, targetX, targetY);
    return;
  }

  // Generate multi-dimensional graphic zig-zag trajectory
  const trajectory = generateZigZagPath(current, endPoint, options);

  // Total movement duration adjusted by distance (450ms to 1100ms)
  const duration = options.durationMs ?? Math.min(1150, Math.max(450, Math.floor(dist * 1.8) + Math.floor(Math.random() * 120)));
  const stepDelay = Math.max(12, Math.floor(duration / trajectory.length));

  for (let i = 0; i < trajectory.length; i++) {
    const pt = trajectory[i];
    await page.mouse.move(pt.x, pt.y);

    // Update real visual cursor on every single frame so the user sees the continuous zig-zag path
    await updateVisualCursor(page, pt.x, pt.y);

    // Dynamic micro-pauses: slower near start and end
    const progress = i / trajectory.length;
    const speedCurve = Math.sin(Math.PI * progress);
    const actualDelay = Math.max(10, Math.floor(stepDelay * (1.1 - speedCurve * 0.4)));
    await page.waitForTimeout(actualDelay);
  }

  setCurrentMousePosition(page, endPoint);
  await updateVisualCursor(page, endPoint.x, endPoint.y);
}

/**
 * Performs a natural human graphic zig-zag movement to a locator, hovers, presses, holds, and releases.
 */
export async function humanClick(
  target: Page | Frame,
  locator: Locator | any,
  options: { timeout?: number; hoverPauseMs?: number } = {}
): Promise<void> {
  const page = "mouse" in target ? target : (target as Frame).page();
  try {
    if (await locator.count() === 0) return;
    const firstEl = locator.first();

    await firstEl.scrollIntoViewIfNeeded({ timeout: options.timeout ?? 8000 }).catch(() => {});
    await page.waitForTimeout(150 + Math.floor(Math.random() * 120));

    const box = await firstEl.boundingBox().catch(() => null);

    if (box && box.width > 0 && box.height > 0) {
      // Natural human landing point: biased toward center with realistic random dispersion
      const offsetX = box.width * (0.35 + Math.random() * 0.3);
      const offsetY = box.height * (0.35 + Math.random() * 0.3);
      const targetX = box.x + offsetX;
      const targetY = box.y + offsetY;

      // 1. Move to target with graphic zig-zag trajectory
      await humanMouseMove(target, targetX, targetY);

      // 2. Pre-click hover dwell pause (reading/settling phase)
      const hoverPause = options.hoverPauseMs ?? (220 + Math.floor(Math.random() * 160));
      await page.waitForTimeout(hoverPause);

      // 3. Mouse down with visual pulse
      await updateVisualCursor(page, targetX, targetY, true);
      await page.mouse.down();

      // 4. Natural press hold duration (80ms - 150ms)
      const pressDuration = 80 + Math.floor(Math.random() * 70);
      await page.waitForTimeout(pressDuration);

      // 5. Mouse up
      await page.mouse.up();

      // 6. Post-click relaxation dwell
      await page.waitForTimeout(200 + Math.floor(Math.random() * 150));
    } else {
      await firstEl.click().catch(() => firstEl.click({ force: true }));
    }
  } catch (err) {
    try {
      await locator.first().click({ force: true });
    } catch (e) {}
  }
}

/**
 * Simulates a continuous, multi-sweep zig-zag review movement across the viewport.
 * ATS anti-bot engines (reCAPTCHA, Turnstile, hCaptcha) monitor mouse displacement,
 * curvature entropy, velocity variance, and dwell before form submit.
 */
export async function simulateZigZagReview(
  target: Page | Frame,
  durationMs: number = 3200
): Promise<void> {
  const page = "mouse" in target ? target : (target as Frame).page();
  console.log("🌀 [HumanMouse]: Simulating graphical zig-zag user review telemetry...");

  try {
    await injectCursorVisualizer(page);
    const viewport = page.viewportSize() || { width: 1280, height: 800 };
    const startTime = Date.now();

    // Create 3 to 5 realistic review inspection waypoints
    const waypoints: Point[] = [
      { x: viewport.width * (0.25 + Math.random() * 0.2), y: 180 + Math.random() * 120 },
      { x: viewport.width * (0.60 + Math.random() * 0.2), y: 280 + Math.random() * 150 },
      { x: viewport.width * (0.35 + Math.random() * 0.2), y: 440 + Math.random() * 150 },
      { x: viewport.width * (0.55 + Math.random() * 0.25), y: 580 + Math.random() * 140 },
    ];

    for (const pt of waypoints) {
      if (Date.now() - startTime >= durationMs) break;

      await humanMouseMove(page, pt.x, pt.y, {
        oscillations: 4 + Math.floor(Math.random() * 3),
        amplitude: 12 + Math.random() * 10,
        overshoot: true,
      });

      // Micro-pause as if candidate is visually skimming that section
      const skimPause = 200 + Math.floor(Math.random() * 250);
      await page.waitForTimeout(skimPause);
    }

    console.log("✅ [HumanMouse]: Zig-zag review telemetry completed.");
  } catch (e) {}
}

/**
 * Backward-compatible alias for simulateHumanMouse using the new graphic zig-zag engine.
 */
export async function simulateHumanMouse(
  page: Page | Frame,
  startPoint?: Point,
  endPoint?: Point
): Promise<void> {
  if (startPoint) {
    const pageObj = "mouse" in page ? page : (page as Frame).page();
    setCurrentMousePosition(pageObj, startPoint);
  }

  if (endPoint) {
    await humanMouseMove(page, endPoint.x, endPoint.y, {
      oscillations: 4,
      amplitude: 14,
      overshoot: true,
    });
  } else {
    await simulateZigZagReview(page, 2500);
  }
}
