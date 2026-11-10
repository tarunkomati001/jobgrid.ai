import { UserProfile, JobDetails } from "../ats.interface";
import { DEFAULT_HRUTIN_WELLFOUND_PROFILE } from "./wellfound-account-store";
import {
  suggestAnswerForQuestion,
  isBigQuestion as sharedIsBigQuestion,
  generateAnswerForQuestion as sharedGenerateAnswerForQuestion
} from "../../application/question-answering";

export const isBigQuestion = sharedIsBigQuestion;

export async function generateAnswerForQuestion(
  question: string,
  job: Partial<JobDetails> = {},
  profile: UserProfile = DEFAULT_HRUTIN_WELLFOUND_PROFILE,
  options?: string[],
  inputType?: string
): Promise<string> {
  return sharedGenerateAnswerForQuestion(question, job, profile, options, inputType);
}
