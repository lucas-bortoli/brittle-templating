import fs from "fs";
import runTemplate from "../dist/index.js";

const source = fs.readFileSync("input.md", "utf-8");
const output = runTemplate(source);
fs.writeFileSync("output.md", output, "utf-8");
