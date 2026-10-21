import fs from "fs";
import path from "path";

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, "workable-inspection.json"), "utf8"));

data.forEach((job: any, i: number) => {
  console.log(`\nJob ${i+1}: ${job.url}`);
  const inputs = job.fieldDetails.filter((f: any) => ["input", "textarea", "select"].includes(f.tagName));
  inputs.forEach((inp: any) => {
    console.log(`  - <${inp.tagName}> name="${inp.name}" id="${inp.id}" dataUi="${inp.dataUi}" label="${inp.labelText?.slice(0, 50)}"`);
  });
});
