/**
 * MaiTab - Manual Update Checking and Synchronization Utility
 *
 * Checks GitHub repository for latest commits, determines if local project is behind,
 * and initiates safe synchronization preserving local modifications and uncommitted changes.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const VersionInfo = require('./version-info.js');
    module.exports = factory(VersionInfo);
  } else {
    root.Updater = factory(root.VersionInfo || {
      version: '1.31',
      fullVersion: '1.31.0',
      commit: 'd0b3c49',
      branch: 'main',
      repository: 'Melony-mai/MaiTab',
      apiUrl: 'https://api.github.com/repos/Melony-mai/MaiTab'
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (VersionInfo) {
  'use strict';

  const DEFAULT_LOCAL_ENDPOINT = (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http'))
    ? window.location.origin
    : 'http://127.0.0.1:8765';

  const Updater = {
    localEndpoint: DEFAULT_LOCAL_ENDPOINT,
    DEFAULT_LOCAL_ENDPOINT
  };

  /**
   * Helper to perform fetch with timeout
   */
  async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  /**
   * Check for updates from GitHub repository or local sync service.
   *
   * @param {Object} [options]
   * @param {string} [options.localEndpoint] - Optional local sync server endpoint
   * @param {string} [options.apiUrl] - Optional GitHub API url override
   * @param {string} [options.localCommit] - Local commit to compare against
   * @returns {Promise<Object>}
   */
  async function checkForUpdates(options = {}) {
    const localEndpoint = options.localEndpoint !== undefined
      ? options.localEndpoint
      : (Updater.localEndpoint || DEFAULT_LOCAL_ENDPOINT);
    const apiUrl = options.apiUrl || VersionInfo.apiUrl || 'https://api.github.com/repos/Melony-mai/MaiTab';
    const localCommit = (options.localCommit || VersionInfo.commit || '').toLowerCase().trim();

    // 1. Try local synchronization service if available (e.g. scripts/sync-server.js or test server)
    if (localEndpoint) {
      try {
        const localStatusUrl = localEndpoint.startsWith('http')
          ? `${localEndpoint}/api/sync/status`
          : localEndpoint;
        const res = await fetchWithTimeout(localStatusUrl, { method: 'GET' }, 1500);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success === false) {
            return {
              success: false,
              status: 'UPDATE_FAILED',
              error: data.error || 'Local synchronization service error'
            };
          }
          if (data && data.success !== false) {
            return {
              success: true,
              source: 'local-git',
              status: data.upToDate ? 'UP_TO_DATE' : 'UPDATE_AVAILABLE',
              upToDate: Boolean(data.upToDate),
              behindCount: typeof data.behindCount === 'number' ? data.behindCount : 0,
              aheadCount: typeof data.aheadCount === 'number' ? data.aheadCount : 0,
              incomingCommits: Array.isArray(data.incomingCommits) ? data.incomingCommits : [],
              hasLocalChanges: Boolean(data.hasLocalChanges),
              modifiedFiles: data.modifiedFiles || [],
              untrackedFiles: data.untrackedFiles || [],
              currentBranch: data.currentBranch || 'main',
              remoteUrl: data.remoteUrl || VersionInfo.repoUrl
            };
          }
        }
      } catch (e) {
        // Local service not running - proceed to remote GitHub API check
      }
    }

    // 2. Query GitHub public REST API directly
    try {
      const commitsEndpoint = `${apiUrl}/commits?sha=main&per_page=10`;
      const res = await fetchWithTimeout(commitsEndpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      }, 7000);

      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData && errData.message) errDetail += `: ${errData.message}`;
        } catch (_) {}
        throw new Error(`GitHub API returned ${errDetail}`);
      }

      const commits = await res.json();
      if (!Array.isArray(commits) || commits.length === 0) {
        return {
          success: true,
          source: 'github-api',
          status: 'UP_TO_DATE',
          upToDate: true,
          behindCount: 0,
          incomingCommits: [],
          message: 'No new commits found.'
        };
      }

      const latestRemoteSha = (commits[0].sha || '').toLowerCase();
      const latestShortSha = latestRemoteSha.substring(0, 7);

      // Check if local commit matches the latest remote commit
      const isUpToDate = Boolean(
        localCommit && (
          latestRemoteSha.startsWith(localCommit) ||
          localCommit.startsWith(latestShortSha)
        )
      );

      if (isUpToDate) {
        return {
          success: true,
          source: 'github-api',
          status: 'UP_TO_DATE',
          upToDate: true,
          behindCount: 0,
          incomingCommits: [],
          latestCommit: {
            sha: latestShortSha,
            message: commits[0].commit?.message?.split('\n')[0] || '',
            date: commits[0].commit?.author?.date || ''
          }
        };
      }

      // Find how many commits ahead the remote is
      let behindIndex = commits.findIndex(c => {
        const cSha = (c.sha || '').toLowerCase();
        return localCommit && (cSha.startsWith(localCommit) || localCommit.startsWith(cSha.substring(0, 7)));
      });

      const incomingList = (behindIndex > 0 ? commits.slice(0, behindIndex) : commits).map(c => {
        const sha = (c.sha || '').substring(0, 7);
        const firstLine = (c.commit?.message || '').split('\n')[0];
        return `${sha} ${firstLine}`.trim();
      });

      const behindCount = incomingList.length;

      return {
        success: true,
        source: 'github-api',
        status: 'UPDATE_AVAILABLE',
        upToDate: false,
        behindCount,
        incomingCommits: incomingList,
        latestCommit: {
          sha: latestShortSha,
          message: commits[0].commit?.message?.split('\n')[0] || '',
          date: commits[0].commit?.author?.date || ''
        }
      };
    } catch (err) {
      return {
        success: false,
        status: 'UPDATE_FAILED',
        error: err.message || 'Failed to connect to GitHub repository.'
      };
    }
  }

  /**
   * Perform manual synchronization.
   *
   * @param {Object} [options]
   * @param {string} [options.localEndpoint] - Optional local sync server endpoint
   * @returns {Promise<Object>}
   */
  async function performSync(options = {}) {
    const localEndpoint = options.localEndpoint !== undefined
      ? options.localEndpoint
      : (Updater.localEndpoint || DEFAULT_LOCAL_ENDPOINT);

    if (localEndpoint) {
      try {
        const syncUrl = localEndpoint.startsWith('http')
          ? `${localEndpoint}/api/sync/perform`
          : localEndpoint;

        const res = await fetchWithTimeout(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, 15000);

        const data = await res.json();
        if (res.ok && data.success) {
          return {
            success: true,
            status: 'UP_TO_DATE',
            latestCommit: data.latestCommit,
            stashedChangesRestored: Boolean(data.stashedChangesRestored),
            message: 'Synchronization completed successfully.'
          };
        } else {
          return {
            success: false,
            status: 'UPDATE_FAILED',
            conflict: Boolean(data.conflict),
            conflictedFiles: data.conflictedFiles || [],
            feedback: data.feedback || data.error || 'Synchronization failed.',
            error: data.error || 'Synchronization failed.'
          };
        }
      } catch (err) {
        // If local sync endpoint was explicitly specified or test server failed
        if (options.throwOnError) throw err;
        return {
          success: false,
          status: 'UPDATE_FAILED',
          error: err.message || 'Unable to connect to local synchronization service.'
        };
      }
    }

    return {
      success: false,
      status: 'UPDATE_FAILED',
      error: 'Synchronization service is not available.'
    };
  }

  Updater.checkForUpdates = checkForUpdates;
  Updater.performSync = performSync;

  return Updater;
});
