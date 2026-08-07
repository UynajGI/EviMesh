#!/usr/bin/env node
import { runCli } from "../src/main.mjs";

runCli(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`error: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  },
);
