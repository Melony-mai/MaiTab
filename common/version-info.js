/**
 * MaiTab - Build and Version Information (v1.6)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VersionInfo = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let commit = '82058e9';
  let fullCommit = '82058e992655393b0a681a50a7c32d72a6d71ef7';

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
    version: '1.6',
    fullVersion: '1.6.0',
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
    },
    setVersion(newVersion, newFull) {
      if (!newVersion) return;
      const clean = String(newVersion).replace(/^v/i, '').trim();
      this.version = clean;
      this.fullVersion = newFull ? String(newFull).replace(/^v/i, '').trim() : (clean.includes('.') && clean.split('.').length === 2 ? `${clean}.0` : clean);
    }
  };

  return VersionInfo;
});
