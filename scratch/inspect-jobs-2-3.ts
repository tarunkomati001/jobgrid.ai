import fs from "fs";
import path from "path";

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, "workable-inspection.json"), "utf8"));

[1, 2].forEach(idx => {
  const item = data[idx];
  console.log(`\n======================================================`);
  console.log(`JOB ${idx+1}: ${item.title}`);
  console.log(`URL: ${item.url}`);
  console.log(`======================================================`);

  const inputs = item.fieldDetails.filter((f: any) => 
    ["input", "textarea", "select"].includes(f.tagName) || 
    f.role === "combobox" || 
    f.dataUi?.includes("input") ||
    f.dataUi?.includes("select")
  );

  console.log(`Inputs / Fields count: ${inputs.length}`);
  inputs.forEach((f: any, i: number) => {
    console.log(`  [${i+1}] <${f.tagName}> type="${f.type}" name="${f.name}" id="${f.id}" data-ui="${f.dataUi}" req=${f.required}`);
    console.log(`      Label: "${f.labelText}"`);
    if (f.placeholder) console.log(`      Placeholder: "${f.placeholder}"`);
    if (f.options?.length) console.log(`      Options: ${JSON.stringify(f.options)}`);
  });
});
