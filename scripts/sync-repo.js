#!/usr/bin/env node

/**
 * MaiTab - Repository Synchronization and Direct Iteration Utility (v1.31)
 *
 * Safely synchronizes the local development repository with the latest changes
 * from the remote GitHub repository:
 * 1. Checks and preserves existing local modifications and uncommitted work (via safe stashing).
 * 2. Fetches latest remote commits and detects divergence (ahead / behind).
 * 3. Updates directly from remote via fast-forward or rebase/merge without requiring manual re-cloning.
 * 4. Detects and handles merge/rebase/stash conflicts safely with actionable diagnostic feedback.
 * 5. Restores stashed work cleanly.
 * 6. Executes the test suite to verify project functionality after synchronization.
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function runGit(command, options = {}) {
  const cwd = options.cwd || repoRoot;
  try {
    const res = execSync(`git ${command}`, {
      cwd,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
      ...options
    });
    return options.raw ? res : (res ? res.trim() : '');
  } catch (err) {
    if (options.ignoreError) {
      return null;
    }
    const errMsg = err.stderr ? err.stderr.toString().trim() : err.message;
    const error = new Error(`Git command failed: "git ${command}"\n${errMsg}`);
    error.status = err.status;
    error.stderr = errMsg;
    throw error;
  }
}

/**
 * Get uncommitted local status: modified, staged, untracked files
 */
function getGitStatus(cwd = repoRoot) {
  const statusOutput = runGit('status --porcelain', { cwd, raw: true, ignoreError: true }) || '';
  const lines = statusOutput.split('\n').filter(Boolean);
  const modified = [];
  const untracked = [];
  const conflicted = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const code = line.slice(0, 2);
    const file = line.slice(3).trim();
    if (code.includes('U') || code === 'AA' || code === 'DD') {
      conflicted.push(file);
    } else if (code === '??') {
      untracked.push(file);
    } else {
      modified.push(file);
    }
  }

  return {
    isClean: lines.length === 0,
    hasLocalChanges: lines.length > 0,
    modifiedFiles: modified,
    untrackedFiles: untracked,
    conflictedFiles: conflicted,
    raw: statusOutput
  };
}

/**
 * Get list of unmerged / conflicted files
 */
function getConflictedFiles(cwd = repoRoot) {
  const diffOutput = runGit('diff --name-only --diff-filter=U', { cwd, ignoreError: true }) || '';
  const files = diffOutput.split('\n').map(s => s.trim()).filter(Boolean);
  if (files.length > 0) return files;

  // Fallback to porcelain inspection
  const status = getGitStatus(cwd);
  return status.conflictedFiles;
}

/**
 * Formats structured, actionable diagnostic feedback for merge / rebase conflicts
 */
function formatConflictFeedback(info) {
  const { phase, conflictedFiles = [], stashLabel, strategy = 'rebase' } = info;
  const lines = [];
  lines.push('\n══════════════════════════════════════════════════════════════');
  lines.push('⚠️  GIT CONFLICT DETECTED DURING SYNCHRONIZATION');
  lines.push('══════════════════════════════════════════════════════════════');

  if (phase === 'sync' || phase === 'rebase' || phase === 'merge') {
    lines.push(`\nConflict occurred while integrating remote commits via ${strategy}.`);
    lines.push('\nConflicted file(s):');
    conflictedFiles.forEach(f => lines.push(`  • ${f}`));

    lines.push('\n📋 Next Steps to Resolve:');
    lines.push('  1. Open each conflicted file and resolve conflict markers (<<<<<<<, =======, >>>>>>>).');
    lines.push('  2. Stage each resolved file:');
    conflictedFiles.forEach(f => lines.push(`     git add "${f}"`));

    if (strategy === 'rebase') {
      lines.push('  3. Continue the rebase:');
      lines.push('     git rebase --continue');
      lines.push('  4. To completely abort the update and return to pre-sync state:');
      lines.push('     git rebase --abort');
    } else {
      lines.push('  3. Complete the merge commit:');
      lines.push('     git commit -m "Merge and resolve conflicts from remote"');
      lines.push('  4. To completely abort the merge:');
      lines.push('     git merge --abort');
    }

    if (stashLabel) {
      lines.push('\n📦 Stashed Local Modifications:');
      lines.push(`  Your uncommitted local changes are safely stashed under: "${stashLabel}".`);
      lines.push('  Once the conflict resolution is completed, restore your stashed work with:');
      lines.push('     git stash pop');
    }
  } else if (phase === 'stash-pop') {
    lines.push('\nRemote commits were integrated successfully, but a conflict occurred');
    lines.push('while restoring your local uncommitted modifications.');
    lines.push('\nConflicted file(s):');
    conflictedFiles.forEach(f => lines.push(`  • ${f}`));

    lines.push('\n📋 Next Steps to Resolve:');
    lines.push('  1. Open each conflicted file and resolve conflict markers.');
    lines.push('  2. Stage each resolved file:');
    conflictedFiles.forEach(f => lines.push(`     git add "${f}"`));
    lines.push('  3. Your stashed changes remain preserved in "git stash list".');
    lines.push('     After resolving, remove the stash entry with:');
    lines.push('     git stash drop');
    lines.push('  4. Verify project integrity:');
    lines.push('     npm test');
  }

  lines.push('══════════════════════════════════════════════════════════════\n');
  return lines.join('\n');
}

/**
 * Check synchronization status without modifying the working tree (dry-run)
 */
async function checkSyncStatus(options = {}) {
  const targetDir = options.cwd || repoRoot;
  const remote = options.remote || 'origin';

  const isGit = runGit('rev-parse --is-inside-work-tree', { cwd: targetDir, ignoreError: true });
  if (!isGit) {
    throw new Error('Target directory is not a Git repository.');
  }

  const currentBranch = runGit('rev-parse --abbrev-ref HEAD', { cwd: targetDir });
  const remoteUrl = runGit(`remote get-url ${remote}`, { cwd: targetDir, ignoreError: true });

  if (!remoteUrl) {
    throw new Error(`Remote "${remote}" is not configured.`);
  }

  // Determine remote tracking ref
  let trackingRef = runGit('rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: targetDir, ignoreError: true });
  if (!trackingRef) {
    trackingRef = `${remote}/${currentBranch}`;
  }

  // Fetch remote references
  runGit(`fetch --prune ${remote}`, { cwd: targetDir });

  const status = getGitStatus(targetDir);
  const behindCount = parseInt(runGit(`rev-list --count HEAD..${trackingRef}`, { cwd: targetDir, ignoreError: true }) || '0', 10);
  const aheadCount = parseInt(runGit(`rev-list --count ${trackingRef}..HEAD`, { cwd: targetDir, ignoreError: true }) || '0', 10);

  let incomingCommits = [];
  if (behindCount > 0) {
    const logOutput = runGit(`log --oneline HEAD..${trackingRef} -n 10`, { cwd: targetDir, ignoreError: true }) || '';
    incomingCommits = logOutput.split('\n').filter(Boolean);
  }

  return {
    currentBranch,
    remote,
    remoteUrl,
    trackingRef,
    isClean: status.isClean,
    hasLocalChanges: status.hasLocalChanges,
    modifiedFiles: status.modifiedFiles,
    untrackedFiles: status.untrackedFiles,
    behindCount,
    aheadCount,
    upToDate: behindCount === 0,
    incomingCommits
  };
}

/**
 * Main Direct Iteration and Synchronization Workflow
 */
async function syncRepository(options = {}) {
  const targetDir = options.cwd || repoRoot;
  const remote = options.remote || 'origin';
  const runTests = options.runTests !== false;
  const strategy = options.strategy === 'merge' ? 'merge' : 'rebase';
  const abortOnConflict = Boolean(options.abortOnConflict);

  console.log('🔄 MaiTab GitHub Repository Direct Iteration & Synchronization');
  console.log('================================================================');

  // 1. Verify git environment
  const isGit = runGit('rev-parse --is-inside-work-tree', { cwd: targetDir, ignoreError: true });
  if (!isGit) {
    console.error('❌ Error: Current directory is not a Git repository.');
    if (options.throwOnError) throw new Error('Not a Git repository');
    process.exit(1);
  }

  const currentBranch = runGit('rev-parse --abbrev-ref HEAD', { cwd: targetDir });
  const remoteUrl = runGit(`remote get-url ${remote}`, { cwd: targetDir, ignoreError: true });

  console.log(`📍 Current Branch: ${currentBranch}`);
  console.log(`🌐 Remote Repository: ${remoteUrl || `No remote "${remote}" configured`}`);

  if (!remoteUrl) {
    console.error(`❌ Error: No remote "${remote}" configured for this repository.`);
    if (options.throwOnError) throw new Error(`No remote ${remote}`);
    process.exit(1);
  }

  // 2. Check for working tree modifications or untracked files
  const statusBefore = getGitStatus(targetDir);
  let stashed = false;
  const stashLabel = `maitab-sync-stash-${Date.now()}`;

  if (statusBefore.hasLocalChanges) {
    console.log('\n📦 Local uncommitted changes detected:');
    if (statusBefore.modifiedFiles.length > 0) {
      console.log(`   Modified (${statusBefore.modifiedFiles.length}): ${statusBefore.modifiedFiles.slice(0, 5).join(', ')}${statusBefore.modifiedFiles.length > 5 ? '...' : ''}`);
    }
    if (statusBefore.untrackedFiles.length > 0) {
      console.log(`   Untracked (${statusBefore.untrackedFiles.length}): ${statusBefore.untrackedFiles.slice(0, 5).join(', ')}${statusBefore.untrackedFiles.length > 5 ? '...' : ''}`);
    }
    console.log('   Safely preserving uncommitted work in stash...');
    const stashRes = runGit(`stash push -u -m "${stashLabel}"`, { cwd: targetDir });
    console.log(`   ${stashRes}`);
    stashed = true;
  } else {
    console.log('\n✨ Working tree is clean. Ready to synchronize.');
  }

  // 3. Fetch latest updates from remote
  console.log(`\n📥 Fetching latest updates from ${remote}...`);
  try {
    runGit(`fetch --prune ${remote}`, { cwd: targetDir });
  } catch (err) {
    console.error(`❌ Failed to fetch from remote ${remote}:`, err.message);
    if (stashed) {
      console.log('Restoring stashed changes...');
      runGit('stash pop', { cwd: targetDir, ignoreError: true });
    }
    if (options.throwOnError) throw err;
    process.exit(1);
  }

  // Determine remote tracking reference
  let trackingRef = runGit('rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd: targetDir, ignoreError: true });
  if (!trackingRef) {
    const hasRemoteBranch = runGit(`rev-parse --verify ${remote}/${currentBranch}`, { cwd: targetDir, ignoreError: true });
    trackingRef = hasRemoteBranch ? `${remote}/${currentBranch}` : `${remote}/main`;
  }

  const behindCount = parseInt(runGit(`rev-list --count HEAD..${trackingRef}`, { cwd: targetDir, ignoreError: true }) || '0', 10);
  const aheadCount = parseInt(runGit(`rev-list --count ${trackingRef}..HEAD`, { cwd: targetDir, ignoreError: true }) || '0', 10);

  console.log(`📊 Status relative to ${trackingRef}: ${behindCount} behind, ${aheadCount} ahead.`);

  // 4. Synchronize
  if (behindCount > 0) {
    console.log(`\n🚀 Synchronizing ${behindCount} new commit(s) from remote (${trackingRef})...`);
    const incomingLog = runGit(`log --oneline HEAD..${trackingRef} -n 5`, { cwd: targetDir, ignoreError: true });
    if (incomingLog) {
      console.log('   Latest incoming commits:');
      incomingLog.split('\n').forEach(line => console.log(`     • ${line}`));
    }

    try {
      if (aheadCount === 0) {
        // Fast-forward update directly
        console.log('   Applying fast-forward merge directly...');
        runGit(`merge --ff-only ${trackingRef}`, { cwd: targetDir });
        console.log('✅ Successfully fast-forwarded to latest remote version.');
      } else if (strategy === 'merge') {
        console.log('   Performing merge commit...');
        runGit(`merge ${trackingRef} -m "Merge remote changes from ${trackingRef}"`, { cwd: targetDir });
        console.log('✅ Successfully merged remote changes.');
      } else {
        console.log('   Rebasing local commits on top of remote changes...');
        runGit(`rebase ${trackingRef}`, { cwd: targetDir });
        console.log('✅ Successfully rebased local commits on top of remote changes.');
      }
    } catch (syncErr) {
      const conflictedFiles = getConflictedFiles(targetDir);
      const feedback = formatConflictFeedback({
        phase: 'sync',
        conflictedFiles,
        stashLabel: stashed ? stashLabel : null,
        strategy
      });

      console.error(feedback);

      if (abortOnConflict) {
        console.log('🔄 --abort-on-conflict enabled: Aborting operation to restore clean state...');
        if (strategy === 'rebase') {
          runGit('rebase --abort', { cwd: targetDir, ignoreError: true });
        } else {
          runGit('merge --abort', { cwd: targetDir, ignoreError: true });
        }
        if (stashed) {
          console.log('   Restoring stashed changes...');
          runGit('stash pop', { cwd: targetDir, ignoreError: true });
        }
      }

      if (options.throwOnError) {
        const err = new Error('Git conflict during remote synchronization');
        err.conflict = true;
        err.phase = 'sync';
        err.conflictedFiles = conflictedFiles;
        throw err;
      }
      process.exit(1);
    }
  } else {
    console.log('✅ Local branch is already up to date with remote.');
  }

  // 5. Restore stashed changes if any
  if (stashed) {
    console.log('\n📂 Restoring local uncommitted modifications from stash...');
    try {
      runGit('stash pop', { cwd: targetDir });
      console.log('✅ Local uncommitted changes restored successfully.');
    } catch (stashErr) {
      const conflictedFiles = getConflictedFiles(targetDir);
      const feedback = formatConflictFeedback({
        phase: 'stash-pop',
        conflictedFiles,
        stashLabel
      });

      console.error(feedback);
      if (options.throwOnError) {
        const err = new Error('Git conflict while restoring stashed changes');
        err.conflict = true;
        err.phase = 'stash-pop';
        err.conflictedFiles = conflictedFiles;
        throw err;
      }
      process.exit(1);
    }
  }

  // 6. Verify project integrity after synchronization
  if (runTests) {
    console.log('\n🧪 Running test suite to verify project integrity after synchronization...');
    const testResult = spawnSync('npm', ['test'], {
      cwd: targetDir,
      stdio: 'inherit'
    });

    if (testResult.status !== 0) {
      console.error('\n❌ Tests failed after synchronization! Please inspect test output above.');
      if (options.throwOnError) throw new Error('Tests failed after sync');
      process.exit(1);
    }
    console.log('✅ All tests passed successfully after synchronization.');
  }

  const latestCommit = runGit('log -1 --oneline', { cwd: targetDir });
  console.log('\n================================================================');
  console.log('🎉 Direct iteration & synchronization completed successfully!');
  console.log(`HEAD is now at: ${latestCommit}`);
  console.log('================================================================\n');

  return {
    success: true,
    latestCommit,
    branch: currentBranch,
    behindCount,
    aheadCount,
    stashedChangesRestored: stashed
  };
}

// CLI handler
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MaiTab Repository Direct Iteration Utility

Usage:
  node scripts/sync-repo.js [options]
  npm run sync
  npm run iterate
  npm run sync:check

Options:
  --check, --dry-run       Check remote status and incoming commits without updating
  --no-tests               Skip running npm test verification after synchronization
  --merge                  Use merge strategy instead of rebase for diverged branches
  --abort-on-conflict      Automatically abort rebase/merge and restore state on conflict
  -h, --help               Display this help message
`);
    process.exit(0);
  }

  const isCheck = args.includes('--check') || args.includes('--dry-run');
  const noTests = args.includes('--no-tests');
  const useMerge = args.includes('--merge');
  const abortOnConflict = args.includes('--abort-on-conflict');

  if (isCheck) {
    checkSyncStatus()
      .then((status) => {
        console.log('\n🔍 MaiTab Repository Sync Status Check');
        console.log('=====================================');
        console.log(`Branch:           ${status.currentBranch}`);
        console.log(`Remote:           ${status.remoteUrl}`);
        console.log(`Tracking:         ${status.trackingRef}`);
        console.log(`Working Tree:     ${status.isClean ? 'Clean' : 'Has uncommitted changes'}`);
        if (!status.isClean) {
          console.log(`  Modified:       ${status.modifiedFiles.length} file(s)`);
          console.log(`  Untracked:      ${status.untrackedFiles.length} file(s)`);
        }
        console.log(`Commits Behind:   ${status.behindCount}`);
        console.log(`Commits Ahead:    ${status.aheadCount}`);
        if (status.behindCount > 0) {
          console.log('\nIncoming Commits:');
          status.incomingCommits.forEach(c => console.log(`  • ${c}`));
          console.log('\nRun "npm run sync" to integrate these changes directly.');
        } else {
          console.log('\n✅ Local codebase is up to date with remote.');
        }
        console.log('=====================================\n');
      })
      .catch((err) => {
        console.error('Check failed:', err.message);
        process.exit(1);
      });
  } else {
    syncRepository({
      runTests: !noTests,
      strategy: useMerge ? 'merge' : 'rebase',
      abortOnConflict
    }).catch((err) => {
      console.error('Fatal error during sync:', err.message);
      process.exit(1);
    });
  }
}

module.exports = {
  syncRepository,
  checkSyncStatus,
  getGitStatus,
  getConflictedFiles,
  formatConflictFeedback
};
