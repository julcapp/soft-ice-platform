const { readdirSync, statSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const rootDir = join(__dirname, '..');
const jsFiles = collectJavaScriptFiles(rootDir, ['node_modules']);

for (const file of jsFiles) {
  run(process.execPath, ['--check', file]);
}

runPrisma(['validate']);
runPrisma(['generate']);

console.log(`Backend build check passed for ${jsFiles.length} JavaScript files.`);

function runPrisma(args) {
  run(process.execPath, [join(rootDir, 'node_modules', 'prisma', 'build', 'index.js'), ...args], {
    cwd: rootDir,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://soft_ice_platform:soft_ice_platform@localhost:5432/soft_ice_platform?schema=public',
    },
  });
}

function collectJavaScriptFiles(dir, ignoredNames = []) {
  return readdirSync(dir).flatMap((entry) => {
    if (ignoredNames.includes(entry)) {
      return [];
    }

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectJavaScriptFiles(fullPath, ignoredNames);
    }

    return fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    env: options.env || process.env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
