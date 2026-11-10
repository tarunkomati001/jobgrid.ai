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
import { RecruiteeAdapter } from "./recruitee/recruitee.adapter";
import { RipplingAdapter } from "./rippling/rippling.adapter";
import { PaylocityAdapter } from "./paylocity/paylocity.adapter";
import { WellfoundAdapter } from "./wellfound/wellfound.adapter";
import { BambooHRAdapter } from "./bamboohr/bamboohr.adapter";
import { JazzHRAdapter } from "./jazzhr/jazzhr.adapter";
import { BreezyHRAdapter } from "./breezyhr/breezyhr.adapter";
import { JobviteAdapter } from "./jobvite/jobvite.adapter";
import { AvatureAdapter } from "./avature/avature.adapter";

export function getAdapterForATS(atsType: ATSType): ATSAdapter {
  switch (atsType) {
    case "AVATURE":
      return new AvatureAdapter();
    case "JOBVITE":
      return new JobviteAdapter();
    case "BREEZYHR":
      return new BreezyHRAdapter();
    case "JAZZHR":
      return new JazzHRAdapter();
    case "BAMBOOHR":
      return new BambooHRAdapter();
    case "WELLFOUND":
      return new WellfoundAdapter();
    case "PAYLOCITY":
      return new PaylocityAdapter();
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
    case "RECRUITEE":
      return new RecruiteeAdapter();
    case "RIPPLING":
      return new RipplingAdapter();
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
