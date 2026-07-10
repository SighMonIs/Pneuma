const express = require('express');
const router = express.Router();
const os = require('os');
const QRCode = require('qrcode');
const plist = require('plist');
const { getDb } = require('../db');

function getLocalIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

function buildServerUrl() {
  const port = process.env.PORT || 3000;
  return `http://${getLocalIp()}:${port}`;
}

// Generates an Apple Shortcuts-compatible plist structure
function buildShortcutPlist(token, serverUrl) {
  const addUrl = `${serverUrl}/api/channels/add`;

  return plist.build({
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: '900',
    WFWorkflowClientVersion: '1249.2',
    WFWorkflowHasShortcutInputVariables: true,
    WFWorkflowTypes: ['ActionExtension'],
    WFWorkflowInputContentItemClasses: ['WFURLContentItem'],
    WFWorkflowName: 'Add to Pneuma',
    WFWorkflowIcon: {
      WFWorkflowIconStartColor: 4282601983,
      WFWorkflowIconGlyphNumber: 59511,
    },
    WFWorkflowActions: [
      {
        WFWorkflowActionIdentifier: 'is.workflow.actions.downloadurl',
        WFWorkflowActionParameters: {
          WFHTTPMethod: 'POST',
          WFURL: addUrl,
          WFHTTPBodyType: 'Form',
          WFFormValues: {
            Value: {
              WFDictionaryFieldValueItems: [
                {
                  WFItemType: 0,
                  WFKey: { Value: { string: 'token' }, WFSerializationType: 'WFTextTokenString' },
                  WFValue: { Value: { string: token }, WFSerializationType: 'WFTextTokenString' },
                },
                {
                  WFItemType: 0,
                  WFKey: { Value: { string: 'url' }, WFSerializationType: 'WFTextTokenString' },
                  WFValue: {
                    Value: {
                      attachmentsByRange: { '{0, 1}': { Aggrandizements: [], Type: 'ExtensionInput' } },
                      string: '￼',
                    },
                    WFSerializationType: 'WFTextTokenString',
                  },
                },
              ],
            },
            WFSerializationType: 'WFDictionaryFieldValue',
          },
        },
      },
      {
        WFWorkflowActionIdentifier: 'is.workflow.actions.notification',
        WFWorkflowActionParameters: {
          WFNotificationActionTitle: 'Pneuma',
          WFNotificationActionBody: {
            Value: { string: 'Channel added!' },
            WFSerializationType: 'WFTextTokenString',
          },
        },
      },
    ],
  });
}

// GET /api/shortcut/setup — HTML setup page
router.get('/setup', async (req, res) => {
  const db = getDb();
  const token = db.prepare("SELECT value FROM settings WHERE key='api_token'").get()?.value;
  const serverUrl = buildServerUrl();
  const addUrl = `${serverUrl}/api/channels/add`;
  const downloadUrl = `${serverUrl}/api/shortcut/download`;

  const qrDataUrl = await QRCode.toDataURL(`${serverUrl}/api/shortcut/setup`, { width: 200, margin: 2 });

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pneuma — iOS Shortcut Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #f0f0f0; padding: 24px; max-width: 600px; margin: 0 auto; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #888; margin-bottom: 32px; }
    .step { margin-bottom: 28px; }
    .step h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #ff4444; margin-bottom: 8px; }
    .step p { color: #ccc; line-height: 1.6; margin-bottom: 8px; }
    .code-box { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 12px 16px; font-family: monospace; font-size: 13px; word-break: break-all; color: #aaa; position: relative; }
    .copy-btn { position: absolute; right: 8px; top: 8px; background: #333; border: none; color: #ccc; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .copy-btn:hover { background: #444; }
    .download-btn { display: inline-block; background: #ff4444; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px; }
    .download-btn:hover { background: #e03030; }
    .qr-wrap { text-align: center; margin: 16px 0; }
    .qr-wrap img { border-radius: 8px; }
    .qr-wrap p { color: #888; font-size: 13px; margin-top: 8px; }
    .token-highlight { color: #ff4444; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Pneuma iOS Shortcut</h1>
  <p class="subtitle">Set up the share sheet shortcut to add YouTube channels from your iPhone.</p>

  <div class="step">
    <h2>Option A — Download Shortcut (Recommended)</h2>
    <p>Tap the button below on your iPhone. iOS will ask you to add the shortcut — tap <strong>Add Shortcut</strong>. Your token and server URL are pre-filled.</p>
    <a class="download-btn" href="${downloadUrl}">Download "Add to Pneuma" Shortcut</a>
    <p style="margin-top:12px;color:#666;font-size:13px;">If iOS doesn't recognise the file, use Option B below.</p>
  </div>

  <div class="step">
    <h2>Option B — Manual Setup</h2>
    <p>Open the <strong>Shortcuts</strong> app → <strong>+</strong> → Add Action → <em>Get Contents of URL</em>, then fill in:</p>
    <p><strong>URL</strong></p>
    <div class="code-box">${addUrl}<button class="copy-btn" onclick="navigator.clipboard.writeText('${addUrl}');this.textContent='Copied!'">Copy</button></div>
    <p style="margin-top:12px;"><strong>Method:</strong> POST &nbsp; <strong>Body type:</strong> Form</p>
    <p><strong>Form fields:</strong></p>
    <div class="code-box">token = <span class="token-highlight">${token}</span><button class="copy-btn" onclick="navigator.clipboard.writeText('${token}');this.textContent='Copied!'">Copy</button></div>
    <div class="code-box" style="margin-top:8px;">url = <em>[Shortcut Input]</em></div>
    <p style="margin-top:12px;">Set <strong>Receives</strong> to <em>URLs</em> so it shows up in the share sheet.</p>
  </div>

  <div class="step">
    <h2>Your Unique Token</h2>
    <div class="code-box">${token}<button class="copy-btn" onclick="navigator.clipboard.writeText('${token}');this.textContent='Copied!'">Copy</button></div>
    <p style="margin-top:8px;">You can regenerate this token in Pneuma Settings at any time.</p>
  </div>

  <div class="step">
    <h2>QR Code (scan from another device)</h2>
    <div class="qr-wrap">
      <img src="${qrDataUrl}" alt="QR Code" width="200" height="200">
      <p>Scan to open this setup page on your iPhone</p>
    </div>
  </div>
</body>
</html>`);
});

// GET /api/shortcut/download — serve the .shortcut file
router.get('/download', (req, res) => {
  const db = getDb();
  const token = db.prepare("SELECT value FROM settings WHERE key='api_token'").get()?.value;
  const serverUrl = buildServerUrl();
  const xml = buildShortcutPlist(token, serverUrl);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="Add to Pneuma.shortcut"');
  res.send(xml);
});

// GET /api/shortcut/qr — returns QR code as PNG for embedding in the settings UI
router.get('/qr', async (req, res) => {
  const serverUrl = buildServerUrl();
  const buf = await QRCode.toBuffer(`${serverUrl}/api/shortcut/setup`, { width: 200, margin: 2 });
  res.setHeader('Content-Type', 'image/png');
  res.send(buf);
});

module.exports = router;
