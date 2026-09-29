import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
fs.copyFileSync(path.join(here, "..", "..", "LICENSE"), path.join(here, "..", "LICENSE"));
