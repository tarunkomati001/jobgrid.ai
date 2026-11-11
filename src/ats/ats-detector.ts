import { Page } from "playwright";

export type ATSType = "ASHBY" | "GREENHOUSE" | "LEVER" | "WORKDAY" | "SMARTRECRUITERS" | "WORKABLE" | "TALEO" | "ORACLE" | "RECRUITEE" | "RIPPLING" | "PAYLOCITY" | "WELLFOUND" | "BAMBOOHR" | "JAZZHR" | "BREEZYHR" | "JOBVITE" | "AVATURE" | "ICIMS" | "UNKNOWN";

/**
 * Detects the ATS from a URL string (fast initial check).
 */
export function detectATSByUrl(urlStr: string): ATSType {
  try {
    const hostname = new URL(urlStr).hostname.toLowerCase();
    
    if (hostname.includes("icims.com") || urlStr.includes(".icims.com")) {
      return "ICIMS";
    }
    if (hostname.includes("avature.net") || urlStr.includes(".avature.net")) {
      return "AVATURE";
    }
    if (hostname.includes("jobvite.com") || urlStr.includes("jobs.jobvite.com")) {
      return "JOBVITE";
    }
    if (hostname.includes("breezy.hr") || urlStr.includes(".breezy.hr")) {
      return "BREEZYHR";
    }
    if (hostname.includes("applytojob.com") || hostname.includes("jazzhr.com") || urlStr.includes(".applytojob.com/apply/")) {
      return "JAZZHR";
    }
    if (hostname.includes("bamboohr.com") || urlStr.includes(".bamboohr.com/careers/")) {
      return "BAMBOOHR";
    }
    if (hostname.includes("wellfound.com") || hostname.includes("angel.co")) {
      return "WELLFOUND";
    }
    if (hostname.includes("paylocity.com") || urlStr.includes("recruiting.paylocity.com")) {
      return "PAYLOCITY";
    }
    if (hostname.includes("rippling.com") || urlStr.includes("ats.rippling.com")) {
      return "RIPPLING";
    }
    if (hostname.includes("recruitee.com")) {
      return "RECRUITEE";
    }
    // Also detect Recruitee career portals with custom domains or /o/... structure
    if (
      urlStr.includes("/o/") &&
      (urlStr.includes("/c/new") ||
        hostname.includes("emergentsoftware.net") ||
        hostname.includes("techwolf.ai") ||
        hostname.startsWith("careers.") ||
        hostname.startsWith("jobs."))
    ) {
      return "RECRUITEE";
    }
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

  if (
    lowerContent.includes("icims.com") ||
    lowerContent.includes("icims") ||
    (await page.$("iframe#icims_content_iframe, [class*='iCIMS_'], [id*='icims'], a[href*='mode=apply']")) !== null
  ) {
    return "ICIMS";
  }

  if (
    lowerContent.includes("avature.net") ||
    lowerContent.includes("avature") ||
    (await page.$("#uploadFileResume, .applicationMethods, [class*='avature'], .tpt_loginBox")) !== null
  ) {
    return "AVATURE";
  }

  if (
    lowerContent.includes("jobvite.com") ||
    lowerContent.includes("jobvite") ||
    (await page.$("#file-input-0, #jv-country-select, .jv-button-apply, [class*='jv-']")) !== null
  ) {
    return "JOBVITE";
  }

  if (
    lowerContent.includes("breezy.hr") ||
    lowerContent.includes("breezy-portal") ||
    (await page.$("input[name='cResume']#main-attachment, a.button.resume, [ng-app='PortalApp']")) !== null
  ) {
    return "BREEZYHR";
  }

  if (
    lowerContent.includes("applytojob.com") ||
    lowerContent.includes("jazzhr") ||
    lowerContent.includes("resumator") ||
    (await page.$("form#form_submit_new_resume, #resumator-submit-resume, input[name^='resumator-'], [data-test='form_submit_new_resume']")) !== null
  ) {
    return "JAZZHR";
  }

  if (
    lowerContent.includes("wellfound.com") ||
    lowerContent.includes("angel.co") ||
    lowerContent.includes("wellfound") ||
    (await page.$("meta[property='og:site_name'][content*='Wellfound' i], [data-test='JobListing'], [class*='styles_jobListing']")) !== null
  ) {
    return "WELLFOUND";
  }
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
  if (
    lowerContent.includes("recruitee.com") ||
    lowerContent.includes("recruitee") ||
    (await page.$("input[name^='candidate.'], button[id*='country-select-input-candidate.phone'], [data-cy='apply-button'], [data-testid='header-tab-apply-button'], [name='candidate.cv'], [name='candidate.coverLetterFile']")) !== null
  ) {
    return "RECRUITEE";
  }
  if (
    lowerContent.includes("rippling.com") ||
    lowerContent.includes("rippling") ||
    (await page.$("input[data-testid='input-first_name'], div[data-testid='phone_number-code'], div[data-testid='sms_opt_in']")) !== null
  ) {
    return "RIPPLING";
  }
  if (
    lowerContent.includes("bamboohr.com") ||
    lowerContent.includes("bamboohr") ||
    (await page.$("button:has-text('Apply for This Job'), [data-fabric-version], [data-one-instance-messageslidedown], [class*='fabric-']")) !== null
  ) {
    return "BAMBOOHR";
  }
  if (
    lowerContent.includes("paylocity.com") ||
    lowerContent.includes("paylocity") ||
    (await page.$("button[data-automation-id='btn-resume'], input#btn-resume, #pcty-wr-apply-info, a[href*='paylocity.com']")) !== null
  ) {
    return "PAYLOCITY";
  }

  return "UNKNOWN";
}
