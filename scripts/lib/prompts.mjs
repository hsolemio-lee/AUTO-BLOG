import fs from "node:fs/promises";
import path from "node:path";

import { ROOT_DIR } from "./paths.mjs";

export async function readPromptTemplate(fileName) {
  const promptPath = path.join(ROOT_DIR, "prompts", fileName);
  return fs.readFile(promptPath, "utf8");
}
