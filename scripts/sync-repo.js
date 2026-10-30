#!/usr/bin/env node

/**
 * MaiTab - Repository Synchronization and Direct Iteration Utility
 *
 * Safely synchronizes local development repository with the latest changes
 * from the remote GitHub repository:
 * 1. Checks for uncommitted or untracked changes and stashes them safely.
 * 2. Fetches and synchronizes the latest commits from origin/main.
 * 3. Handles rebase and merge scenarios safely, reporting conflicts if any.
 * 4. Restores stashed work cleanly.
 * 5. Runs test suite to verify project integrity after synchronization.
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function runGit(command, options = {}) {
  try {
    return execSync(`git ${command}`, {
      cwd: options.cwd || repoRoot,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
      ...options
    }).trim();
  } catch (err) {
    if (options.ignoreError) {
      return null;
    }
    const errMsg = err.stderr ? err.stderr.toString().trim() : err.message;
    throw new Error(`Git command failed: "git ${command}"\n${errMsg}`);
  }
}

async function syncRepository(options = { runTests: true }) {
  const targetDir = options.cwd || repoRoot;
  console.log('🔄 MaiTab GitHub Repository Synchronization');
  console.log('==========================================');

  // 1. Verify git environment
  const isGit = runGit('rev-parse --is-inside-work-tree', { cwd: targetDir, ignoreError: true });
  if (!isGit) {
    console.error('❌ Error: Current directory is not a Git repository.');
    if (options.throwOnError) throw new Error('Not a Git repository');
    process.exit(1);
  }

  const currentBranch = runGit('rev-parse --abbrev-ref HEAD', { cwd: targetDir });
  const remoteUrl = runGit('remote get-url origin', { cwd: targetDir, ignoreError: true });

  console.log(`📍 Current Branch: ${currentBranch}`);
  console.log(`🌐 Remote Repository: ${remoteUrl || 'No remote configured'}`);

  if (!remoteUrl) {
    console.error('❌ Error: No remote "origin" configured for this repository.');
    if (options.throwOnError) throw new Error('No remote origin');
    process.exit(1);
  }

  // 2. Check for working tree modifications or untracked files
  const statusOutput = runGit('status --porcelain', { cwd: targetDir });
  const hasLocalChanges = Boolean(statusOutput && statusOutput.length > 0);
  let stashed = false;
  const stashLabel = `maitab-sync-stash-${Date.now()}`;

  if (hasLocalChanges) {
    console.log('\n📦 Local uncommitted changes detected. Safely stashing before sync...');
    const stashRes = runGit(`stash push -u -m "${stashLabel}"`, { cwd: targetDir });
    console.log(`   ${stashRes}`);
    stashed = true;
  } else {
    console.log('\n✨ Working tree is clean. Proceeding directly.');
  }

  // 3. Fetch latest commits from remote
  console.log(`\n📥 Fetching latest updates from origin/${currentBranch}...`);
  try {
    runGit(`fetch origin ${currentBranch}`, { cwd: targetDir });
  } catch (err) {
    console.error(`❌ Failed to fetch from origin/${currentBranch}:`, err.message);
    if (stashed) {
      console.log('Restoring stashed changes...');
      runGit('stash pop', { cwd: targetDir });
    }
    if (options.throwOnError) throw err;
    process.exit(1);
  }

  // Check how many commits ahead/behind
  const behindCount = parseInt(runGit(`rev-list --count HEAD..origin/${currentBranch}`, { cwd: targetDir, ignoreError: true }) || '0', 10);
  const aheadCount = parseInt(runGit(`rev-list --count origin/${currentBranch}..HEAD`, { cwd: targetDir, ignoreError: true }) || '0', 10);

  console.log(`📊 Status relative to origin/${currentBranch}: ${behindCount} behind, ${aheadCount} ahead.`);

  // 4. Synchronize
  if (behindCount > 0) {
    console.log(`🚀 Pulling and rebasing ${behindCount} new commit(s) from remote...`);
    try {
      runGit(`pull --rebase origin ${currentBranch}`, { cwd: targetDir });
      console.log('✅ Successfully rebased on top of remote changes.');
    } catch (err) {
      console.error('\n⚠️ Conflict detected during rebase synchronization!');
      console.error(err.message);
      console.error('\nTo abort this rebase and return to previous state, run: git rebase --abort');
      if (options.throwOnError) throw err;
      process.exit(1);
    }
  } else {
    console.log('✅ Local branch is already up to date with remote.');
  }

  // 5. Restore stashed changes if any
  if (stashed) {
    console.log('\n📂 Restoring local stashed changes...');
    try {
      runGit('stash pop', { cwd: targetDir });
      console.log('✅ Stashed changes restored successfully.');
    } catch (err) {
      console.error('\n⚠️ Conflict occurred while popping stashed changes!');
      console.error('Please inspect conflicts with "git status" and resolve manually.');
      if (options.throwOnError) throw err;
      process.exit(1);
    }
  }

  // 6. Verify project functionality after synchronization
  if (options.runTests) {
    console.log('\n🧪 Running test suite to verify project integrity...');
    const testResult = spawnSync('npm', ['test'], {
      cwd: targetDir,
      stdio: 'inherit'
    });

    if (testResult.status !== 0) {
      console.error('\n❌ Tests failed after synchronization. Please inspect test output above.');
      if (options.throwOnError) throw new Error('Tests failed after sync');
      process.exit(1);
    }
    console.log('✅ All tests passed successfully after synchronization.');
  }

  const latestCommit = runGit('log -1 --oneline', { cwd: targetDir });
  console.log('\n==========================================');
  console.log('🎉 Synchronization completed successfully!');
  console.log(`HEAD is now at: ${latestCommit}`);
  console.log('==========================================\n');
  return { success: true, latestCommit, branch: currentBranch };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const noTests = args.includes('--no-tests');
  syncRepository({ runTests: !noTests }).catch((err) => {
    console.error('Fatal error during sync:', err);
    process.exit(1);
  });
}

module.exports = { syncRepository };
