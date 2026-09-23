/**
 * Production entry point (npm start).
 *
 * Order of business:
 *   1. sync the Prisma schema with the platform-provided DATABASE_URL
 *   2. optionally seed the demo data on an empty database
 *   3. start Next.js on the port the platform assigns (PORT)
 *
 * Steps 1 and 2 are deliberately NON-FATAL. A container that exits before it
 * listens produces the "builds correctly and never listens on its port" failure
 * where the logs say nothing useful; warning and continuing instead means the
 * app comes up, /api/health reports the database as down, and the real error is
 * visible in the deploy logs.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function run(command, args, { label, fatal = true }) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error || result.status !== 0) {
    const why = result.error ? result.error.message : `exit code ${result.status}`;
    if (fatal) {
      console.error(`\n✖ ${label} failed (${why}).\n`);
      process.exit(typeof result.status === "number" ? result.status : 1);
    }
    console.warn(`\n⚠ ${label} failed (${why}) — continuing to start the server.\n`);
    return false;
  }
  return true;
}

/** Run the locally installed Prisma CLI directly (no npm/shell in between). */
function prisma(args, opts = {}) {
  let cli;
  try {
    cli = require.resolve("prisma/build/index.js");
  } catch {
    console.warn("⚠ Prisma CLI is not installed — skipping the schema sync.");
    return false;
  }
  return run(process.execPath, [cli, ...args], { label: `prisma ${args.join(" ")}`, ...opts });
}

// 1. There is no separate migration step on this platform, so the app applies
//    its own schema on boot. Anything the operator set by hand still wins.
prisma(["db", "push", "--skip-generate"], { fatal: false });

// 2. One-off demo seed — only when explicitly asked for, and only into an empty
//    database (prisma/seed.ts exits without wiping when users already exist).
if (process.env.DEMO_SEED_ON_START === "true") {
  if (process.env.DEMO_MODE !== "true") {
    console.warn('⚠ DEMO_SEED_ON_START is set but DEMO_MODE is not "true" — skipping the demo seed.');
  } else {
    let tsx;
    try {
      tsx = require.resolve("tsx/cli");
    } catch {
      tsx = null;
    }
    if (tsx) {
      run(process.execPath, [tsx, "prisma/seed.ts"], { label: "demo seed", fatal: false });
    } else {
      console.warn("⚠ tsx is not installed — run `npm run db:seed` once to load the demo data.");
    }
  }
}

// 3. Serve. Next.js reads PORT itself.
let nextBin;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch {
  console.error("✖ Next.js is not installed — cannot start the server.");
  process.exit(1);
}
run(process.execPath, [nextBin, "start"], { label: "next start" });
