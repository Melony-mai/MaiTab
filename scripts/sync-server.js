#!/usr/bin/env node

/**
 * MaiTab - Local Repository Synchronization Server
 *
 * Provides a local HTTP bridge allowing the Chrome extension interface
 * to securely trigger repository synchronization and inspect git status,
 * while safely stashing uncommitted modifications and handling conflicts.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { checkSyncStatus, syncRepository } = require('./sync-repo.js');

const rootDir = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.SYNC_PORT || '8765', 10);

function updateVersionInfoFile(latestCommit) {
  try {
    const versionFile = path.join(rootDir, 'common/version-info.js');
    if (!fs.existsSync(versionFile)) return;
    let content = fs.readFileSync(versionFile, 'utf8');
    const shortSha = (latestCommit.match(/^([a-f0-9]{7,40})/i) || ['', ''])[1];
    if (shortSha) {
      content = content.replace(/let\s+commit\s*=\s*'[a-f0-9]+'/i, `let commit = '${shortSha}'`);
      content = content.replace(/commit:\s*'[a-f0-9]+'/i, `commit: '${shortSha}'`);
      fs.writeFileSync(versionFile, content, 'utf8');
    }
  } catch (_) {}
}

const server = http.createServer(async (req, res) => {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/sync/status' || url.pathname === '/status') {
    try {
      const status = await checkSyncStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...status }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  } else if ((url.pathname === '/api/sync/perform' || url.pathname === '/sync') && req.method === 'POST') {
    try {
      const result = await syncRepository({ throwOnError: true, runTests: false });
      if (result.latestCommit) {
        updateVersionInfoFile(result.latestCommit);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        conflict: Boolean(err.conflict),
        conflictedFiles: err.conflictedFiles || [],
        feedback: err.message,
        error: err.message
      }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`📡 MaiTab Local Synchronization Server listening on http://127.0.0.1:${PORT}`);
    console.log('   Ready for manual sync requests from Chrome extension interface.');
  });
}

module.exports = { server, PORT };
