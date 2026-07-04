#!/usr/bin/env node
/**
 * Fetches cross-repo awareness data from OracleSalesApp-Web and writes WEB_STATUS.md.
 * Usage:  npm run web:status
 * Token:  set GITHUB_TOKEN env var to avoid the 60 req/hr unauthenticated rate limit.
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OWNER = "Cedie99";
const REPO = "OracleSalesApp-Web";
const OUTPUT_FILE = path.join(__dirname, "..", "WEB_STATUS.md");

const WATCHED_DIRS = ["app", "lib", "types", "components"];
const ROOT_FILES = ["package.json", ".env.local.example"];

// ─── GitHub API ──────────────────────────────────────────────────────────────

function get(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${OWNER}/${REPO}${endpoint}`,
      headers: {
        "User-Agent": "OracleSalesApp-Mobile-SyncScript",
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    };

    https
      .get(options, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          if (res.statusCode === 403) {
            reject(
              new Error(
                "GitHub API rate limit reached. Set GITHUB_TOKEN to increase the limit."
              )
            );
            return;
          }
          if (res.statusCode === 404) {
            resolve(null); // file may not exist in the web repo
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API ${res.statusCode} on ${endpoint}: ${raw}`));
            return;
          }
          resolve(JSON.parse(raw));
        });
      })
      .on("error", reject);
  });
}

function getRaw(owner, repo, filepath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "raw.githubusercontent.com",
      path: `/${owner}/${repo}/main/${filepath}`,
      headers: {
        "User-Agent": "OracleSalesApp-Mobile-SyncScript",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    };

    https
      .get(options, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          if (res.statusCode === 404) {
            resolve(null);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`raw.githubusercontent ${res.statusCode} on ${filepath}`));
            return;
          }
          resolve(raw);
        });
      })
      .on("error", reject);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isWatchedSourceFile(filePath) {
  const ext = path.extname(filePath);
  if (![".ts", ".tsx", ".js"].includes(ext)) return false;
  const topDir = filePath.split("/")[0];
  return WATCHED_DIRS.includes(topDir);
}

// Group a flat list of paths by their top-level directory
function groupByDir(paths) {
  const map = {};
  for (const p of paths) {
    const dir = p.split("/")[0];
    if (!map[dir]) map[dir] = [];
    map[dir].push(p);
  }
  return map;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Syncing status from ${OWNER}/${REPO}...\n`);

  // Parallel: commits, merged PRs, full file tree
  const [commits, allPRs, tree] = await Promise.all([
    get("/commits?sha=main&per_page=10"),
    get("/pulls?state=closed&base=main&per_page=20&sort=updated&direction=desc"),
    get("/git/trees/main?recursive=1"),
  ]);

  const mergedPRs = (allPRs ?? []).filter((pr) => pr.merged_at);

  // Collect source files to fetch from the recursive tree
  const sourceFiles = (tree?.tree ?? [])
    .filter((entry) => entry.type === "blob" && isWatchedSourceFile(entry.path))
    .map((entry) => entry.path);

  const allFilesToFetch = [...ROOT_FILES, ...sourceFiles];

  console.log(
    `  Found ${sourceFiles.length} source files across [${WATCHED_DIRS.join(", ")}]`
  );
  console.log(`  Fetching ${allFilesToFetch.length} files total...\n`);

  // Fetch all file contents in parallel
  const fileContents = await Promise.all(
    allFilesToFetch.map(async (filePath) => {
      const content = await getRaw(OWNER, REPO, filePath);
      return { filePath, content };
    })
  );

  // ─── Build WEB_STATUS.md ───────────────────────────────────────────────────

  const lines = [];
  const now = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  lines.push(`# Web App Status — \`${OWNER}/${REPO}\``);
  lines.push(``);
  lines.push(`> **Last synced:** ${now}`);
  lines.push(`> Run \`npm run web:status\` to refresh.`);
  lines.push(`> Shared Supabase project — changes here may affect the mobile app.`);
  lines.push(``);
  lines.push(`---`);

  // ── Recent Commits ──────────────────────────────────────────────────────────
  lines.push(``);
  lines.push(`## Recent Commits on \`main\` (last 10)`);
  lines.push(``);
  if (!commits?.length) {
    lines.push(`_No commits found._`);
  } else {
    for (const c of commits) {
      const sha = c.sha.slice(0, 7);
      const msg = c.commit.message.split("\n")[0];
      const author = c.commit.author.name;
      const date = fmtDate(c.commit.author.date);
      lines.push(`- \`${sha}\` **${msg}** — ${author} · ${date}`);
    }
  }

  // ── Recently Merged PRs ─────────────────────────────────────────────────────
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Recently Merged PRs → \`main\``);
  lines.push(``);
  if (!mergedPRs.length) {
    lines.push(`_No recently merged PRs found._`);
  } else {
    for (const pr of mergedPRs) {
      const merged = fmtDate(pr.merged_at);
      lines.push(
        `- [#${pr.number}](${pr.html_url}) **${pr.title}** — \`${pr.head.ref}\` · merged ${merged} by ${pr.user.login}`
      );
    }
  }

  // ── Root Files ──────────────────────────────────────────────────────────────
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Root-Level Files`);

  for (const { filePath, content } of fileContents.filter((f) =>
    ROOT_FILES.includes(f.filePath)
  )) {
    lines.push(``);
    lines.push(`### \`${filePath}\``);
    lines.push(``);
    if (content === null) {
      lines.push(`_File not found in the web repo._`);
    } else {
      const ext = path.extname(filePath).replace(".", "") || "text";
      lines.push(`\`\`\`${ext}`);
      lines.push(content.trimEnd());
      lines.push(`\`\`\``);
    }
  }

  // ── Source Files grouped by directory ──────────────────────────────────────
  const sourceResults = fileContents.filter((f) => !ROOT_FILES.includes(f.filePath));
  const grouped = groupByDir(sourceResults.map((f) => f.filePath));

  for (const dir of WATCHED_DIRS) {
    const files = grouped[dir];
    if (!files?.length) continue;

    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`## \`${dir}/\``);

    for (const filePath of files.sort()) {
      const { content } = sourceResults.find((f) => f.filePath === filePath);
      lines.push(``);
      lines.push(`### \`${filePath}\``);
      lines.push(``);
      if (content === null) {
        lines.push(`_File not found._`);
      } else {
        const ext = path.extname(filePath).replace(".", "");
        lines.push(`\`\`\`${ext}`);
        lines.push(content.trimEnd());
        lines.push(`\`\`\``);
      }
    }
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(
    `_Auto-generated by \`scripts/sync-web-status.mjs\`. Do not edit manually._`
  );

  fs.writeFileSync(OUTPUT_FILE, lines.join("\n"), "utf8");
  console.log(`✓ WEB_STATUS.md written (${lines.length} lines).`);
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
