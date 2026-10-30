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

  return {
    version: '1.31',
    fullVersion: '1.31.0',
    commit: '8bbafc8',
    fullCommit: '8bbafc806ac0e6ae687f7d115b96a4fc4b9a1d57',
    branch: 'main',
    repository: 'Melony-mai/MaiTab',
    repoUrl: 'https://github.com/Melony-mai/MaiTab',
    apiUrl: 'https://api.github.com/repos/Melony-mai/MaiTab'
  };
});
