import dotenv from "dotenv";
dotenv.config();
import { generateAnswerForQuestion } from "../src/application/question-answering";

async function main() {
  const job = { title: "Software Engineer", company: "Tech Corp", ats: "PAYLOCITY" };
  const profile: any = { firstName: "Hrutin", lastName: "Nammi", headline: "Software Engineer" };
  const prompt1 = "Tell me about a time you had to get a manager who didn't report to you to change how they were doing something. What was the situation, what did you actually do, and what happened? (required)";
  const prompt2 = "Walk me through a location or team where turnover was a serious problem. How did you figure out what was actually driving it, and what specifically changed as a result? (required)";

  try {
    console.log("Testing Prompt 1...");
    const ans1 = await generateAnswerForQuestion(prompt1, job, profile, undefined, "textarea");
    console.log("Ans 1:", ans1);

    console.log("Testing Prompt 2...");
    const ans2 = await generateAnswerForQuestion(prompt2, job, profile, undefined, "textarea");
    console.log("Ans 2:", ans2);
  } catch (err: any) {
    console.error("Error in generateAnswerForQuestion:", err);
  }
}

main();

