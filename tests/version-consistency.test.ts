/**
 * Version consistency test — asserts CHANGELOG.md latest release heading
 * matches package.json version.
 *
 * Paths are resolved relative to the test file (not process.cwd()) so the
 * test is cwd-independent.
 *
 * Run with: npm test (bare `node --test`)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

describe("version consistency", () => {
  it("CHANGELOG.md latest release heading equals package.json version", () => {
    const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));
    const changelog = readFileSync(join(rootDir, "CHANGELOG.md"), "utf-8");

    // Find the first ## [version] heading that is NOT ## [Unreleased]
    const lines = changelog.split("\n");
    let changelogVersion: string | undefined;
    for (const line of lines) {
      const m = line.match(/^## \[([^\]]+)\]/);
      if (m && m[1] !== "Unreleased") {
        changelogVersion = m[1];
        break;
      }
    }

    assert.ok(changelogVersion, "CHANGELOG.md should have at least one version heading (## [x.y.z])");
    assert.strictEqual(
      changelogVersion,
      pkg.version,
      `CHANGELOG.md latest release [${changelogVersion}] does not match package.json version [${pkg.version}]`,
    );
  });
});