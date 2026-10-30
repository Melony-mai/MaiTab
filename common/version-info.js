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
    commit: 'd0b3c49',
    fullCommit: 'd0b3c4907ce7dd9f37c127c5e39a0dbd37af53a4',
    branch: 'main',
    repository: 'Melony-mai/MaiTab',
    repoUrl: 'https://github.com/Melony-mai/MaiTab',
    apiUrl: 'https://api.github.com/repos/Melony-mai/MaiTab'
  };
});
