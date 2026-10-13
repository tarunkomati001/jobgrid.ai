import fs from "fs";
import path from "path";

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, "workable-inspection.json"), "utf8"));
const item = data[1]; // Job 2
console.log(`JOB 2: ${item.title}`);
const inputs = item.fieldDetails.filter((f: any) => 
  ["input", "textarea", "select"].includes(f.tagName) || 
  f.role === "combobox" || 
  f.dataUi?.includes("input") ||
  f.dataUi?.includes("select")
);

inputs.forEach((f: any, i: number) => {
  console.log(`  [${i+1}] <${f.tagName}> type="${f.type}" name="${f.name}" id="${f.id}" data-ui="${f.dataUi}" req=${f.required}`);
  console.log(`      Label: "${f.labelText}"`);
  if (f.placeholder) console.log(`      Placeholder: "${f.placeholder}"`);
});
