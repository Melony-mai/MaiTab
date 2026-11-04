/**
 * MaiTab - Manual Update Checking and Synchronization Utility
 *
 * Checks GitHub repository for latest commits, determines if local project is behind,
 * and initiates safe synchronization preserving local modifications and uncommitted changes.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const VersionInfo = require('./version-info.js');
    let StorageManager;
    try {
      StorageManager = require('./storage.js');
    } catch (_) {}
    module.exports = factory(VersionInfo, StorageManager);
  } else {
    root.Updater = factory(root.VersionInfo || {
      version: '1.5',
      fullVersion: '1.5.0',
      commit: 'd0b3c49',
      branch: 'main',
      repository: 'Melony-mai/MaiTab',
      apiUrl: 'https://api.github.com/repos/Melony-mai/MaiTab'
    }, root.StorageManager);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (VersionInfo, StorageManager) {
  'use strict';

  const DEFAULT_LOCAL_ENDPOINT = (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http'))
    ? window.location.origin
    : 'http://127.0.0.1:8765';

  const Updater = {
    localEndpoint: DEFAULT_LOCAL_ENDPOINT,
    DEFAULT_LOCAL_ENDPOINT,
    lastSyncCommit: null
  };

  function getStorageManager() {
    const candidates = [
      (typeof window !== 'undefined' && window.StorageManager) ? window.StorageManager : null,
      (typeof globalThis !== 'undefined' && globalThis.StorageManager) ? globalThis.StorageManager : null,
      (typeof StorageManager !== 'undefined' && StorageManager) ? StorageManager : null
    ];
    for (const c of candidates) {
      if (c && typeof c.getSettings === 'function' && typeof c.recordSuccessfulSync === 'function') {
        return c;
      }
    }
    return null;
  }

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
   * Resolves the effective local commit to compare against.
   * Priority:
   * 1. Explicit options.localCommit
   * 2. Saved synchronization state in StorageManager (lastSyncCommit)
   * 3. Updater.lastSyncCommit in-memory
   * 4. VersionInfo.commit
   *
   * @param {Object} [options]
   * @returns {Promise<string>}
   */
  async function resolveLocalCommit(options = {}) {
    if (options.localCommit) {
      return String(options.localCommit).toLowerCase().trim();
    }

    const sm = getStorageManager();
    if (sm && typeof sm.getSyncState === 'function') {
      try {
        const syncState = await sm.getSyncState();
        if (syncState && syncState.lastSyncCommit) {
          const clean = syncState.lastSyncCommit.toLowerCase().trim();
          if (clean) return clean;
        }
      } catch (_) {}
    }

    if (Updater.lastSyncCommit) {
      return String(Updater.lastSyncCommit).toLowerCase().trim();
    }

    if (VersionInfo && VersionInfo.commit) {
      return String(VersionInfo.commit).toLowerCase().trim();
    }

    return '';
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
    const localCommit = await resolveLocalCommit(options);

    const sm = getStorageManager();
    let syncState = null;
    if (sm && typeof sm.getSyncState === 'function') {
      try {
        syncState = await sm.getSyncState();
      } catch (_) {}
    }

    // Helper to test if a commit SHA is considered already synchronized
    const isShaSynced = (sha) => {
      if (!sha) return false;
      const s = String(sha).toLowerCase().trim();
      if (localCommit && (s.startsWith(localCommit) || localCommit.startsWith(s.substring(0, 7)))) {
        return true;
      }
      if (Array.isArray(syncState?.syncedCommits)) {
        return syncState.syncedCommits.some(sc => {
          const scLower = String(sc).toLowerCase().trim();
          return scLower && (s.startsWith(scLower) || scLower.startsWith(s.substring(0, 7)));
        });
      }
      return false;
    };

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
            let incoming = Array.isArray(data.incomingCommits) ? data.incomingCommits : [];
            let upToDate = Boolean(data.upToDate);
            let behindCount = typeof data.behindCount === 'number' ? data.behindCount : incoming.length;

            // Verify against local synchronization state
            if (!upToDate && (localCommit || syncState?.syncedCommits?.length)) {
              incoming = incoming.filter(c => {
                const cSha = (String(c).match(/^([a-f0-9]{7,40})/i) || ['', ''])[1].toLowerCase();
                if (!cSha) return true;
                return !isShaSynced(cSha);
              });
              if (incoming.length === 0) {
                upToDate = true;
                behindCount = 0;
              } else {
                behindCount = incoming.length;
              }
            }

            return {
              success: true,
              source: 'local-git',
              status: upToDate ? 'UP_TO_DATE' : 'UPDATE_AVAILABLE',
              upToDate,
              behindCount,
              aheadCount: typeof data.aheadCount === 'number' ? data.aheadCount : 0,
              incomingCommits: incoming,
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

      // Check if local commit matches the latest remote commit or was already synced
      const isUpToDate = isShaSynced(latestRemoteSha);

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
      let behindIndex = commits.findIndex(c => isShaSynced(c.sha));

      const incomingList = (behindIndex > 0 ? commits.slice(0, behindIndex) : commits)
        .filter(c => !isShaSynced(c.sha))
        .map(c => {
          const sha = (c.sha || '').substring(0, 7);
          const firstLine = (c.commit?.message || '').split('\n')[0];
          return `${sha} ${firstLine}`.trim();
        });

      if (incomingList.length === 0) {
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

    let syncResult = null;

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
          syncResult = {
            success: true,
            status: 'UP_TO_DATE',
            upToDate: true,
            behindCount: 0,
            incomingCommits: [],
            latestCommit: data.latestCommit || options.targetCommit || options.latestCommit,
            commit: data.commit,
            fullCommit: data.fullCommit,
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

    if (!syncResult) {
      return {
        success: false,
        status: 'UPDATE_FAILED',
        error: 'Synchronization service is not available.'
      };
    }

    // Record synchronized commit state immediately
    const rawCommit = syncResult.commit || syncResult.latestCommit || options.targetCommit || '';
    const shaMatch = typeof rawCommit === 'string'
      ? (rawCommit.match(/^([a-f0-9]{7,40})/i) || ['', rawCommit])[1]
      : (rawCommit?.sha || '');
    const shortSha = shaMatch ? shaMatch.substring(0, 7).toLowerCase() : '';

    if (shortSha) {
      Updater.lastSyncCommit = shortSha;
      if (typeof VersionInfo !== 'undefined' && VersionInfo && typeof VersionInfo.setCommit === 'function') {
        VersionInfo.setCommit(shortSha, syncResult.fullCommit);
      } else if (typeof VersionInfo !== 'undefined' && VersionInfo) {
        VersionInfo.commit = shortSha;
      }
    }

    const sm = getStorageManager();
    if (sm && typeof sm.recordSuccessfulSync === 'function') {
      try {
        await sm.recordSuccessfulSync({
          commit: shortSha,
          fullCommit: syncResult.fullCommit,
          latestCommit: syncResult.latestCommit,
          incomingCommits: options.incomingCommits || []
        });
      } catch (_) {}
    }

    return syncResult;
  }

  Updater.resolveLocalCommit = resolveLocalCommit;
  Updater.checkForUpdates = checkForUpdates;
  Updater.performSync = performSync;

  return Updater;
});
