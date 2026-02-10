import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));

function safeGit(command, fallback) {
  try {
    const value = execSync(command, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

const commitCount = safeGit("git rev-list --count HEAD", "0");
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA
  ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8)
  : safeGit("git rev-parse --short=8 HEAD", "local");
const commitDate = safeGit("git log -1 --format=%cs", "1970-01-01");
const baseVersionCommit = safeGit(
  `git log --reverse --format=%H -G '"version": "${pkg.version}"' -- package.json | head -n 1`,
  "",
);
const baseVersionCommitCount = baseVersionCommit
  ? safeGit(`git rev-list --count ${baseVersionCommit}`, commitCount)
  : commitCount;

function semverWithPatchCounter(version, currentCount, baseCount) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return version;
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const basePatch = Number.parseInt(match[3], 10);
  const patchDelta = Math.max(0, Number.parseInt(currentCount, 10) - Number.parseInt(baseCount, 10));
  const patch = basePatch + patchDelta;
  return `${major}.${minor}.${patch}`;
}

const versionWithCounter = semverWithPatchCounter(pkg.version, commitCount, baseVersionCommitCount);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: versionWithCounter,
    NEXT_PUBLIC_APP_COMMIT: commitSha,
    NEXT_PUBLIC_APP_DATE: commitDate,
  },
};

export default nextConfig;
