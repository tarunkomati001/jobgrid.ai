import * as fs from "fs";

const data = JSON.parse(fs.readFileSync("scratch/jobvite_inspection.json", "utf-8"));
for (const item of data) {
  console.log("-----------------------------------------");
  console.log("URL:", item.currentUrl);
  console.log("Title:", item.title);
  console.log("Submit button:", item.submitButtons);
  console.log("Inputs (non-hidden):");
  item.inputs.filter((i: any) => i.type !== "hidden").forEach((i: any) => {
    console.log(`  - [${i.type}] id="${i.id}" label="${i.label}" req=${i.required} opts=[${i.options?.slice(0, 3)?.join(", ")}]`);
  });
}

