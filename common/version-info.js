/**
 * MaiTab - Build and Version Information (v1.5)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VersionInfo = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let commit = 'c24fcf0';
  let fullCommit = '294b74c3e86c1228229b46ef6791e32ba06d644e';

  // In Node.js / dev environment, dynamically detect git commit if available
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const { execSync } = require('child_process');
      const gitHead = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (gitHead) {
        fullCommit = gitHead;
        commit = gitHead.substring(0, 7);
      }
    } catch (_) {}
  }

  const VersionInfo = {
    version: '1.5',
    fullVersion: '1.5.0',
    commit,
    fullCommit,
    branch: 'main',
    repository: 'Melony-mai/MaiTab',
    repoUrl: 'https://github.com/Melony-mai/MaiTab',
    apiUrl: 'https://api.github.com/repos/Melony-mai/MaiTab',
    setCommit(newCommit, newFull) {
      if (!newCommit) return;
      const clean = String(newCommit).trim();
      const match = clean.match(/^([a-f0-9]{7,40})/i);
      const sha = match ? match[1] : clean;
      this.commit = sha.substring(0, 7).toLowerCase();
      this.fullCommit = newFull ? String(newFull).trim().toLowerCase() : (sha.length === 40 ? sha.toLowerCase() : this.commit);
    }
  };

  return VersionInfo;
});
