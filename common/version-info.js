/**
 * MaiTab - Build and Version Information (v1.31)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.VersionInfo = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let commit = '294b74c';
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

  return {
    version: '1.31',
    fullVersion: '1.31.0',
    commit,
    fullCommit,
    branch: 'main',
    repository: 'Melony-mai/MaiTab',
    repoUrl: 'https://github.com/Melony-mai/MaiTab',
    apiUrl: 'https://api.github.com/repos/Melony-mai/MaiTab'
  };
});
