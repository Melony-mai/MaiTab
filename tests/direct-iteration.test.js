const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const {
  syncRepository,
  checkSyncStatus,
  getGitStatus,
  getConflictedFiles,
  formatConflictFeedback
} = require('../scripts/sync-repo.js');

function setupTestRepos() {
  const tmpRemote = fs.mkdtempSync(path.join(os.tmpdir(), 'iter-remote-'));
  const tmpLocal = fs.mkdtempSync(path.join(os.tmpdir(), 'iter-local-'));

  execSync('git init --bare -b main', { cwd: tmpRemote });
  execSync('git init -b main', { cwd: tmpLocal });
  execSync('git config user.email "developer@example.com"', { cwd: tmpLocal });
  execSync('git config user.name "MaiTab Developer"', { cwd: tmpLocal });
  execSync(`git remote add origin "${tmpRemote}"`, { cwd: tmpLocal });

  fs.writeFileSync(path.join(tmpLocal, 'README.md'), '# MaiTab\nInitial repo state.');
  fs.writeFileSync(path.join(tmpLocal, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }, null, 2));
  execSync('git add . && git commit -m "initial commit"', { cwd: tmpLocal });
  execSync('git push -u origin main', { cwd: tmpLocal });

  return { tmpRemote, tmpLocal };
}

function cleanupTestRepos(repos) {
  if (repos.tmpRemote && fs.existsSync(repos.tmpRemote)) {
    fs.rmSync(repos.tmpRemote, { recursive: true, force: true });
  }
  if (repos.tmpLocal && fs.existsSync(repos.tmpLocal)) {
    fs.rmSync(repos.tmpLocal, { recursive: true, force: true });
  }
}

test('Direct Repository Iteration and GitHub Synchronization Suite', async (t) => {

  await t.test('1. Retrieve and synchronize latest remote commits directly', async () => {
    const repos = setupTestRepos();
    try {
      // Simulate remote changes pushed by another team member/CI
      const tmpWorker = fs.mkdtempSync(path.join(os.tmpdir(), 'iter-worker-'));
      try {
        execSync(`git clone "${repos.tmpRemote}" "${tmpWorker}"`);
        execSync('git config user.email "peer@example.com"', { cwd: tmpWorker });
        execSync('git config user.name "Peer Developer"', { cwd: tmpWorker });

        fs.writeFileSync(path.join(tmpWorker, 'feature-a.js'), 'export const featureA = true;\n');
        execSync('git add . && git commit -m "feat: add feature A"', { cwd: tmpWorker });
        fs.writeFileSync(path.join(tmpWorker, 'feature-b.js'), 'export const featureB = true;\n');
        execSync('git add . && git commit -m "feat: add feature B"', { cwd: tmpWorker });
        execSync('git push origin main', { cwd: tmpWorker });
      } finally {
        fs.rmSync(tmpWorker, { recursive: true, force: true });
      }

      // Check dry-run status first
      const checkRes = await checkSyncStatus({ cwd: repos.tmpLocal });
      assert.strictEqual(checkRes.upToDate, false, 'Check must report not up to date');
      assert.strictEqual(checkRes.behindCount, 2, 'Must detect exactly 2 incoming commits');
      assert.strictEqual(checkRes.incomingCommits.length, 2);

      // Perform synchronization
      const syncRes = await syncRepository({ cwd: repos.tmpLocal, runTests: false });
      assert.strictEqual(syncRes.success, true);
      assert.strictEqual(syncRes.behindCount, 2);

      // Verify files now exist locally without manual re-cloning
      assert.strictEqual(fs.existsSync(path.join(repos.tmpLocal, 'feature-a.js')), true);
      assert.strictEqual(fs.existsSync(path.join(repos.tmpLocal, 'feature-b.js')), true);

      // Verify repo is now up to date
      const postCheck = await checkSyncStatus({ cwd: repos.tmpLocal });
      assert.strictEqual(postCheck.upToDate, true);
      assert.strictEqual(postCheck.behindCount, 0);
    } finally {
      cleanupTestRepos(repos);
    }
  });

  await t.test('2. Preserve existing local modifications and uncommitted work', async () => {
    const repos = setupTestRepos();
    try {
      // 1. Remote pushes a new utility file
      const tmpWorker = fs.mkdtempSync(path.join(os.tmpdir(), 'iter-worker2-'));
      try {
        execSync(`git clone "${repos.tmpRemote}" "${tmpWorker}"`);
        execSync('git config user.email "peer@example.com"', { cwd: tmpWorker });
        execSync('git config user.name "Peer Developer"', { cwd: tmpWorker });
        fs.writeFileSync(path.join(tmpWorker, 'remote-utils.js'), 'module.exports = { sync: true };\n');
        execSync('git add . && git commit -m "feat: add remote utils"', { cwd: tmpWorker });
        execSync('git push origin main', { cwd: tmpWorker });
      } finally {
        fs.rmSync(tmpWorker, { recursive: true, force: true });
      }

      // 2. Local has dirty working tree:
      // - modified tracked file
      // - untracked new file
      // - staged file
      fs.appendFileSync(path.join(repos.tmpLocal, 'README.md'), '\nLocal uncommitted documentation work.\n');
      fs.writeFileSync(path.join(repos.tmpLocal, 'local-draft.txt'), 'Important in-progress draft.');
      fs.writeFileSync(path.join(repos.tmpLocal, 'staged-file.js'), 'const staged = 1;\n');
      execSync('git add staged-file.js', { cwd: repos.tmpLocal });

      const statusBefore = getGitStatus(repos.tmpLocal);
      assert.strictEqual(statusBefore.hasLocalChanges, true);
      assert.ok(statusBefore.modifiedFiles.includes('README.md'));
      assert.ok(statusBefore.untrackedFiles.includes('local-draft.txt'));

      // 3. Synchronize
      const syncRes = await syncRepository({ cwd: repos.tmpLocal, runTests: false });
      assert.strictEqual(syncRes.success, true);
      assert.strictEqual(syncRes.stashedChangesRestored, true);

      // 4. Verify remote update was integrated AND local changes were safely preserved
      assert.strictEqual(fs.existsSync(path.join(repos.tmpLocal, 'remote-utils.js')), true);
      assert.ok(fs.readFileSync(path.join(repos.tmpLocal, 'README.md'), 'utf8').includes('Local uncommitted documentation work.'));
      assert.strictEqual(fs.readFileSync(path.join(repos.tmpLocal, 'local-draft.txt'), 'utf8'), 'Important in-progress draft.');
      assert.strictEqual(fs.readFileSync(path.join(repos.tmpLocal, 'staged-file.js'), 'utf8'), 'const staged = 1;\n');
    } finally {
      cleanupTestRepos(repos);
    }
  });

  await t.test('3. Detect and handle Git rebase conflicts safely with diagnostic feedback', async () => {
    const repos = setupTestRepos();
    try {
      // Remote modifies README.md
      const tmpWorker = fs.mkdtempSync(path.join(os.tmpdir(), 'iter-worker3-'));
      try {
        execSync(`git clone "${repos.tmpRemote}" "${tmpWorker}"`);
        execSync('git config user.email "peer@example.com"', { cwd: tmpWorker });
        execSync('git config user.name "Peer Developer"', { cwd: tmpWorker });
        fs.writeFileSync(path.join(tmpWorker, 'README.md'), '# Remote Version\nConflicting remote line.');
        execSync('git add . && git commit -m "update readme from remote"', { cwd: tmpWorker });
        execSync('git push origin main', { cwd: tmpWorker });
      } finally {
        fs.rmSync(tmpWorker, { recursive: true, force: true });
      }

      // Local commits conflicting change to README.md
      fs.writeFileSync(path.join(repos.tmpLocal, 'README.md'), '# Local Version\nConflicting local line.');
      execSync('git add . && git commit -m "update readme locally"', { cwd: repos.tmpLocal });

      // Run syncRepository expecting conflict detection
      let threwConflict = false;
      try {
        await syncRepository({ cwd: repos.tmpLocal, runTests: false, throwOnError: true });
      } catch (err) {
        threwConflict = true;
        assert.strictEqual(err.conflict, true);
        assert.strictEqual(err.phase, 'sync');
        assert.ok(err.conflictedFiles.includes('README.md'));
      }
      assert.strictEqual(threwConflict, true, 'Sync must catch rebase conflict and raise error');

      // Verify conflict feedback formatting
      const feedback = formatConflictFeedback({
        phase: 'sync',
        conflictedFiles: ['README.md'],
        strategy: 'rebase'
      });
      assert.ok(feedback.includes('GIT CONFLICT DETECTED'));
      assert.ok(feedback.includes('README.md'));
      assert.ok(feedback.includes('git rebase --continue'));
      assert.ok(feedback.includes('git rebase --abort'));

      // Abort rebase to clean up test repo
      execSync('git rebase --abort', { cwd: repos.tmpLocal });
    } finally {
      cleanupTestRepos(repos);
    }
  });

  await t.test('4. Detect and handle stash pop conflicts safely with diagnostic feedback', async () => {
    const repos = setupTestRepos();
    try {
      // Remote modifies package.json
      const tmpWorker = fs.mkdtempSync(path.join(os.tmpdir(), 'iter-worker4-'));
      try {
        execSync(`git clone "${repos.tmpRemote}" "${tmpWorker}"`);
        execSync('git config user.email "peer@example.com"', { cwd: tmpWorker });
        execSync('git config user.name "Peer Developer"', { cwd: tmpWorker });
        fs.writeFileSync(path.join(tmpWorker, 'package.json'), JSON.stringify({ name: 'remote-name', version: '2.0.0' }, null, 2));
        execSync('git add . && git commit -m "remote package update"', { cwd: tmpWorker });
        execSync('git push origin main', { cwd: tmpWorker });
      } finally {
        fs.rmSync(tmpWorker, { recursive: true, force: true });
      }

      // Local leaves uncommitted modification on the exact same file
      fs.writeFileSync(path.join(repos.tmpLocal, 'package.json'), JSON.stringify({ name: 'local-uncommitted-name', version: '3.0.0' }, null, 2));

      let threwStashConflict = false;
      try {
        await syncRepository({ cwd: repos.tmpLocal, runTests: false, throwOnError: true });
      } catch (err) {
        threwStashConflict = true;
        assert.strictEqual(err.conflict, true);
        assert.strictEqual(err.phase, 'stash-pop');
        assert.ok(err.conflictedFiles.includes('package.json'));
      }
      assert.strictEqual(threwStashConflict, true, 'Sync must catch stash pop conflict');

      const feedback = formatConflictFeedback({
        phase: 'stash-pop',
        conflictedFiles: ['package.json'],
        stashLabel: 'test-stash'
      });
      assert.ok(feedback.includes('restoring your local uncommitted modifications'));
      assert.ok(feedback.includes('package.json'));
      assert.ok(feedback.includes('git stash drop'));
    } finally {
      cleanupTestRepos(repos);
    }
  });

  await t.test('5. Verify all version references across codebase match v1.5', () => {
    // 1. manifest.json
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(manifest.version, '1.5', 'manifest.json version must be 1.5');

    // 2. package.json
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.version, '1.5.0', 'package.json version must be 1.5.0');
    assert.ok(pkg.scripts.sync, 'package.json must contain sync script');
    assert.ok(pkg.scripts['sync:check'], 'package.json must contain sync:check script');
    assert.ok(pkg.scripts.iterate, 'package.json must contain iterate script');

    // 3. common/i18n.js
    const I18n = require('../common/i18n.js');
    ['en', 'zh-CN', 'ja'].forEach(lang => {
      I18n.setLanguage(lang);
      assert.strictEqual(I18n.t('brandVersion'), 'v1.5', `i18n brandVersion for ${lang} must be v1.5`);
    });

    // 4. popup/popup.html
    const popupHtml = fs.readFileSync(path.join(rootDir, 'popup/popup.html'), 'utf8');
    assert.ok(popupHtml.includes('data-i18n="brandVersion">v1.5</span>'), 'popup.html must display v1.5 badge');

    // 5. options/options.html
    const optionsHtml = fs.readFileSync(path.join(rootDir, 'options/options.html'), 'utf8');
    assert.ok(optionsHtml.includes('data-i18n="brandVersion">v1.5</span>'), 'options.html must display v1.5 badge');

    // 6. common/version-info.js
    const versionInfo = require('../common/version-info.js');
    assert.strictEqual(versionInfo.version, '1.5', 'version-info.js must report version 1.5');
    assert.strictEqual(versionInfo.fullVersion, '1.5.0', 'version-info.js must report fullVersion 1.5.0');

    // 7. POPUP_UI_SPEC.md
    const specMd = fs.readFileSync(path.join(rootDir, 'POPUP_UI_SPEC.md'), 'utf8');
    assert.ok(specMd.includes('<span class="badge">v1.5</span>'), 'POPUP_UI_SPEC.md must reflect v1.5');
  });

});
