import { db } from "./db";
import { v4 as uuidv4 } from "uuid";

export type ApplicationEventType =
  | "JOB_OPENED"
  | "ATS_DETECTED"
  | "FORM_EXTRACTED"
  | "FORM_FILLED"
  | "RESUME_UPLOADED"
  | "VALIDATION_PASSED"
  | "SCREENSHOT_CAPTURED"
  | "SUBMITTED"
  | "FAILED"
  | "DRY_RUN_SUBMIT";

/**
 * Logs an event related to a specific job application.
 */
export async function logApplicationEvent(
  applicationId: string,
  eventType: ApplicationEventType,
  metadata: Record<string, any> = {}
): Promise<void> {
  console.log(`[Event Log] Application [${applicationId}] -> ${eventType}`);
  try {
    const id = uuidv4();
    const metadataStr = JSON.stringify(metadata);
    await db.query(
      `INSERT INTO application_events (id, application_id, event_type, metadata)
       VALUES ($1, $2, $3, $4)`,
      [id, applicationId, eventType, metadataStr]
    );
  } catch (error) {
    console.error("Failed to log application event:", error);
  }
}
