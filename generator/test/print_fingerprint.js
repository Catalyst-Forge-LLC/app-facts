#!/usr/bin/env node
/** Print inputs_fingerprint for a target path (used by Python cross-runtime tests). */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectRepoFacts, inputsFingerprint } from "../generate_app_facts.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(process.argv[2] || path.join(here, "fixtures", "mini-repo"));
process.stdout.write(inputsFingerprint(detectRepoFacts(target)));
