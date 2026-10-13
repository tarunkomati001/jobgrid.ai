import { Page } from "playwright";
import { ATSAdapter } from "./ats.interface";
import { detectATSByPage, detectATSByUrl, ATSType } from "./ats-detector";
import { AshbyAdapter } from "./ashby/ashby.adapter";
import { GreenhouseAdapter } from "./greenhouse/greenhouse.adapter";
import { LeverAdapter } from "./lever/lever.adapter";
import { SmartRecruitersAdapter } from "./smartrecruiters/smartrecruiters.adapter";
import { WorkdayAdapter } from "./workday/workday.adapter";
import { WorkableAdapter } from "./workable/workable.adapter";
import { TaleoAdapter } from "./taleo/taleo.adapter";
import { OracleAdapter } from "./oracle/oracle.adapter";

export function getAdapterForATS(atsType: ATSType): ATSAdapter {
  switch (atsType) {
    case "GREENHOUSE":
      return new GreenhouseAdapter();
    case "LEVER":
      return new LeverAdapter();
    case "SMARTRECRUITERS":
      return new SmartRecruitersAdapter();
    case "WORKDAY":
      return new WorkdayAdapter();
    case "WORKABLE":
      return new WorkableAdapter();
    case "TALEO":
      return new TaleoAdapter();
    case "ORACLE":
      return new OracleAdapter();
    case "ASHBY":
    default:
      return new AshbyAdapter();
  }
}

export async function detectAndGetAdapter(page: Page, url?: string): Promise<{ ats: ATSType; adapter: ATSAdapter }> {
  let ats: ATSType = "UNKNOWN";
  if (url) {
    ats = detectATSByUrl(url);
  }
  if (ats === "UNKNOWN") {
    ats = await detectATSByPage(page);
  }
  return {
    ats,
    adapter: getAdapterForATS(ats),
  };
}
