#!/usr/bin/env node
// Starts Metro against an explicit Supabase environment instead of whatever
// is currently sitting in .env.local. Bare `expo start` has no way to say
// "this run targets staging" — the project it hits depends on whichever env
// file was last edited, and you find out only after writing to it. This
// script closes that gap: it loads the named env file, refuses to start if
// the project ref inside it doesn't match what that environment name
// promises, and prints which project is about to receive writes.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENVS = {
  staging: {
    file: ".env.staging.local",
    projectRef: "xhxjbzesuzprwdelrdwh",
    label: "STAGING",
    color: "32",
  },
  prod: {
    file: ".env.local",
    projectRef: "itpskcyojtpcpjwolieb",
    label: "PRODUCTION",
    color: "31",
  },
};

const envName = process.argv[2];
const config = ENVS[envName];
if (!config) {
  console.error(`Usage: node scripts/dev-env.mjs <${Object.keys(ENVS).join("|")}>`);
  process.exit(1);
}

const envPath = resolve(process.cwd(), config.file);
if (!existsSync(envPath)) {
  console.error(
    `Missing ${config.file}. Ask the project lead for ${config.label} credentials before running this.`
  );
  process.exit(1);
}

const vars = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}

const url = vars.EXPO_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes(config.projectRef)) {
  console.error(
    `Refusing to start: ${config.file}'s EXPO_PUBLIC_SUPABASE_URL does not match the ` +
      `${config.label} project (expected ref ${config.projectRef}). Got: ${url || "(empty)"}`
  );
  process.exit(1);
}

console.log(
  `\x1b[${config.color}m\x1b[1m>>> Metro starting against ${config.label} Supabase (${config.projectRef}) <<<\x1b[0m`
);

const child = spawn("npx", ["expo", "start", "--dev-client"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ...vars },
});

child.on("exit", (code) => process.exit(code ?? 0));
