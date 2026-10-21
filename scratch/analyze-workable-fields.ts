import fs from "fs";
import path from "path";

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, "workable-inspection.json"), "utf8"));

for (let i = 0; i < data.length; i++) {
  const item = data[i];
  console.log(`\n======================================================`);
  console.log(`URL [${i+1}]: ${item.url}`);
  console.log(`TITLE: ${item.title}`);
  console.log(`======================================================`);

  const inputs = item.fieldDetails.filter((f: any) => 
    ["input", "textarea", "select"].includes(f.tagName) || 
    f.role === "combobox" || 
    f.role === "radio" ||
    f.dataUi?.includes("input") ||
    f.dataUi?.includes("select")
  );

  console.log(`Inputs / Fields count: ${inputs.length}`);
  inputs.forEach((f: any, idx: number) => {
    console.log(`  [${idx+1}] <${f.tagName}> type="${f.type}" name="${f.name}" id="${f.id}" data-ui="${f.dataUi}" required=${f.required}`);
    console.log(`      Label: "${f.labelText}"`);
    if (f.placeholder) console.log(`      Placeholder: "${f.placeholder}"`);
    if (f.options?.length) console.log(`      Options: ${JSON.stringify(f.options)}`);
  });

  console.log(`\nSubmit Buttons:`);
  item.submitButtons.forEach((b: any) => {
    console.log(`  <button> text="${b.text}" data-ui="${b.dataUi}"`);
  });

  console.log(`\nFile Uploads:`);
  item.fileUploads.forEach((u: any) => {
    console.log(`  <${u.tagName}> name="${u.name}" id="${u.id}" data-ui="${u.dataUi}" accept="${u.accept}"`);
  });
}
