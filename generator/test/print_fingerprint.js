#!/usr/bin/env node
/** Print inputs_fingerprint for a target path (used by Python cross-runtime tests). */
const path = require("path");
const { detectRepoFacts, inputsFingerprint } = require("../generate_app_facts.js");
const target = path.resolve(process.argv[2] || path.join(__dirname, "fixtures", "mini-repo"));
process.stdout.write(inputsFingerprint(detectRepoFacts(target)));
