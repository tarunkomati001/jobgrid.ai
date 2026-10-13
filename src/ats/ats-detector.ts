import { Page } from "playwright";

export type ATSType = "ASHBY" | "GREENHOUSE" | "LEVER" | "WORKDAY" | "SMARTRECRUITERS" | "WORKABLE" | "TALEO" | "ORACLE" | "UNKNOWN";

/**
 * Detects the ATS from a URL string (fast initial check).
 */
export function detectATSByUrl(urlStr: string): ATSType {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    
    if (hostname.includes("ashbyhq.com")) {
      return "ASHBY";
    }
    if (hostname.includes("greenhouse.io")) {
      return "GREENHOUSE";
    }
    if (hostname.includes("lever.co")) {
      return "LEVER";
    }
    if (hostname.includes("myworkdayjobs.com")) {
      return "WORKDAY";
    }
    if (hostname.includes("smartrecruiters.com")) {
      return "SMARTRECRUITERS";
    }
    if (hostname.includes("workable.com")) {
      return "WORKABLE";
    }
    if (hostname.includes("taleo.net")) {
      return "TALEO";
    }
    if (hostname.includes("careers.oracle.com") || hostname.includes("oraclecloud.com")) {
      return "ORACLE";
    }
  } catch (error) {
    console.error("Failed to parse URL for ATS detection:", urlStr);
  }
  return "UNKNOWN";
}

/**
 * Detects the ATS by examining the loaded browser page (robust fallback).
 */
export async function detectATSByPage(page: Page): Promise<ATSType> {
  const url = page.url();
  const urlDetection = detectATSByUrl(url);
  if (urlDetection !== "UNKNOWN") {
    return urlDetection;
  }

  // Fallback: check DOM elements and scripts for signature markers
  const content = await page.content();
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes("ashbyhq.com") || (await page.$("[class*='ashby']")) !== null) {
    return "ASHBY";
  }
  if (lowerContent.includes("greenhouse.io") || (await page.$("#grnhse_app")) !== null) {
    return "GREENHOUSE";
  }
  if (lowerContent.includes("lever.co") || (await page.$("[class*='lever']")) !== null) {
    return "LEVER";
  }
  if (lowerContent.includes("myworkdayjobs.com") || (await page.$("[class*='workday']")) !== null) {
    return "WORKDAY";
  }
  if (lowerContent.includes("smartrecruiters.com") || (await page.$("spl-input, oc-button, spl-button, [class*='smartrecruiters']")) !== null) {
    return "SMARTRECRUITERS";
  }
  if (lowerContent.includes("workable.com") || (await page.$("[data-ui='application-form'], [data-ui='careers-page-content'], form[action*='workable']")) !== null) {
    return "WORKABLE";
  }
  if (lowerContent.includes("taleo.net") || (await page.$("[class*='taleo'], [class*='oracletaleo'], #TBE_theForm")) !== null) {
    return "TALEO";
  }
  if (lowerContent.includes("careers.oracle.com") || lowerContent.includes("oraclecloud.com") || (await page.$("[class*='oracle']")) !== null) {
    return "ORACLE";
  }

  return "UNKNOWN";
}
