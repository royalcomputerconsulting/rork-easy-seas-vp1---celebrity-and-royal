import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const expoRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(expoRoot, '..');

const pathsToSync = [
  'app',
  'assets',
  'backend',
  'components',
  'constants',
  'hooks',
  'lib',
  'mocks',
  'state',
  'types',
];

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function copyDirectory(sourceDir, destinationDir) {
  await fs.rm(destinationDir, { recursive: true, force: true });
  await ensureDir(destinationDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
      continue;
    }

    await ensureDir(path.dirname(destinationPath));
    await fs.copyFile(sourcePath, destinationPath);
  }
}

async function syncPath(relativePath) {
  const sourcePath = path.join(repoRoot, relativePath);
  const destinationPath = path.join(expoRoot, relativePath);

  if (!(await exists(sourcePath))) {
    console.log(`[sync-from-root] Skipping missing path: ${relativePath}`);
    return;
  }

  const sourceStats = await fs.stat(sourcePath);

  if (sourceStats.isDirectory()) {
    console.log(`[sync-from-root] Syncing directory: ${relativePath}`);
    await copyDirectory(sourcePath, destinationPath);
    return;
  }

  await fs.rm(destinationPath, { force: true });
  await ensureDir(path.dirname(destinationPath));
  console.log(`[sync-from-root] Syncing file: ${relativePath}`);
  await fs.copyFile(sourcePath, destinationPath);
}

async function main() {
  if (expoRoot === repoRoot) {
    console.log('[sync-from-root] Expo root matches repo root. Nothing to sync.');
    return;
  }

  const repoAppPath = path.join(repoRoot, 'app');
  if (!(await exists(repoAppPath))) {
    console.log('[sync-from-root] Parent app directory not found. Nothing to sync.');
    return;
  }

  console.log(`[sync-from-root] Repo root: ${repoRoot}`);
  console.log(`[sync-from-root] Expo root: ${expoRoot}`);

  for (const relativePath of pathsToSync) {
    await syncPath(relativePath);
  }

  console.log('[sync-from-root] Sync complete.');
}

main().catch((error) => {
  console.error('[sync-from-root] Sync failed.', error);
  process.exit(1);
});
