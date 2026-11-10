import dotenv from "dotenv";
dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  console.log("ListModels Status:", res.status, res.statusText);
  const data = await res.json() as any;
  if (data.models) {
    console.log("Available models:", data.models.map((m: any) => m.name));
  } else {
    console.log("Error / Result:", JSON.stringify(data));
  }
}

listModels().catch(console.error);

