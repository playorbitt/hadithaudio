// HTML documentation served at api.hadith.to/ and /v1 for browsers.
export const DOCS_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hadith API v1 — Documentation</title>
<meta name="description" content="Read-only access to hadith Arabic text, word tokens, audio and word-level timings.">
<link rel="icon" href="https://hadith.to/favicon.svg">
<style>
:root{--bg:#f7f1e4;--fg:#1e1b16;--mute:#6b604f;--line:#e2d8c4;--card:#fffaf0;--acc:#1f6b45;--gold:#a8742b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:820px;margin:0 auto;padding:40px 20px 80px}
header{display:flex;align-items:baseline;gap:10px;border-bottom:1px solid var(--line);padding-bottom:14px}
header a{color:var(--fg);font-weight:700;text-decoration:none;font-size:20px}.badge{border:1px solid var(--line);border-radius:6px;padding:0 6px;color:var(--mute);font-size:13px}
nav{display:flex;flex-wrap:wrap;gap:14px;margin:12px 0 30px;font-size:15px}nav a{color:var(--mute);text-decoration:none;padding:6px 0}nav a:hover{color:var(--fg)}
h1{font-size:40px;margin:0 0 6px}h2{margin-top:44px;padding-top:24px;border-top:1px solid var(--line)}
.lead{color:var(--mute);font-size:19px}
code,pre{font-family:ui-monospace,Consolas,monospace;font-size:14px}
pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow:auto}
.ep{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:18px 0 8px;font-family:ui-monospace,Consolas,monospace}
.ep b{color:var(--acc);margin-right:8px}
.note{border-left:4px solid var(--gold);padding:6px 14px;background:var(--card);border-radius:0 8px 8px 0}
table{width:100%;border-collapse:collapse;margin:10px 0}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mute);font-size:13px}
a{color:var(--acc)}footer{margin-top:50px;color:var(--mute);font-size:14px}
</style></head><body><main>
<header><a href="https://hadith.to/">hadith.to</a><span class="badge">v1</span></header>
<nav><a href="#overview">Overview</a><a href="#auth">Authentication</a><a href="#endpoints">Endpoints</a><a href="#format">Response format</a><a href="#collections">Collections</a><a href="#errors">Errors</a></nav>

<section id="overview"><h1>Hadith API v1</h1>
<p class="lead">Read-only access to hadith Arabic text, structured word tokens, audio availability and word-level timing data.</p>
<pre>BASE URL  https://api.hadith.to/v1</pre>
<p>Responses are JSON. Record identifiers are source record numbers within each collection. CORS is enabled for browser applications.</p></section>

<section id="auth"><h2>Authentication</h2>
<p>No API key is required. Please cache responses where practical and avoid unnecessary repeated requests.</p>
<p class="note">Audio is not proxied by the API. Responses contain direct <code>cdn.hadith.to</code> URLs when media is available.</p></section>

<section id="endpoints"><h2>Endpoints</h2>
<div class="ep"><b>GET</b>/collections</div><p>Lists collections, the highest record number in each, and whether its recitation is synthetic.</p>
<div class="ep"><b>GET</b>/hadith/{collection}/{record}</div><p>Returns the Arabic text, word tokens, media availability and links.</p>
<table><tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
<tr><td><code>collection</code></td><td>string</td><td>A collection ID listed below.</td></tr>
<tr><td><code>record</code></td><td>integer</td><td>Positive source record number.</td></tr>
<tr><td><code>include=timings</code></td><td>query</td><td>Adds the full word-timing object as <code>wordTimings</code> (also available as <code>timings</code>).</td></tr></table>
<pre>GET https://api.hadith.to/v1/hadith/musnad-ahmad/1
GET https://api.hadith.to/v1/hadith/musnad-ahmad/1?include=timings</pre>
<div class="ep"><b>GET</b>/audio/{collection}/{record}</div><p>Returns media availability plus direct audio and timing URLs.</p>
<div class="ep"><b>GET</b>/health</div><p>Returns service health and API version.</p></section>

<section id="format"><h2>Response format</h2>
<pre>{
  "collection": "musnad-ahmad",
  "record": 1,
  "citation": 1,
  "arabic": "...",
  "tokens": [
    { "id": "...", "position": 1, "text": "..." }
  ],
  "media": {
    "available": true,
    "audio": "https://cdn.hadith.to/...",
    "timings": "https://cdn.hadith.to/..."
  }
}</pre>
<p>Fields may be <code>null</code> when unavailable. Synthetic collections also return a <code>synthesisDisclosure</code>.</p></section>

<section id="collections"><h2>Collection IDs</h2>
<table><tr><th>ID</th><th>Collection</th></tr>
<tr><td><code>bukhari</code></td><td>Sahih al-Bukhari</td></tr><tr><td><code>muslim</code></td><td>Sahih Muslim (records start at 93)</td></tr>
<tr><td><code>tirmidhi</code></td><td>Jami at-Tirmidhi</td></tr><tr><td><code>nasai</code></td><td>Sunan an-Nasa&#39;i</td></tr>
<tr><td><code>abudawud</code></td><td>Sunan Abi Dawud</td></tr><tr><td><code>ibnmajah</code></td><td>Sunan Ibn Majah</td></tr>
<tr><td><code>malik</code></td><td>Muwatta Malik</td></tr><tr><td><code>riyad</code></td><td>Riyad as-Salihin</td></tr>
<tr><td><code>musnad-ahmad</code></td><td>Musnad Ahmad</td></tr><tr><td><code>nawawi40</code></td><td>An-Nawawi&#39;s Forty (human recitation)</td></tr>
<tr><td><code>qudsi40</code></td><td>Forty Hadith Qudsi (synthetic recitation)</td></tr><tr><td><code>shahwaliullah40</code></td><td>Forty Hadith of Shah Waliullah (synthetic recitation)</td></tr></table></section>

<section id="errors"><h2>Errors</h2>
<pre>{
  "error": {
    "code": "record_not_found",
    "message": "Record is outside this collection."
  }
}</pre>
<table><tr><th>Status</th><th>Meaning</th></tr>
<tr><td>400</td><td>Invalid record parameter</td></tr><tr><td>404</td><td>Unknown endpoint, collection or record</td></tr>
<tr><td>405</td><td>Unsupported HTTP method</td></tr><tr><td>502</td><td>Source temporarily unavailable</td></tr></table></section>
<footer>Hadith API v1 · <a href="https://hadith.to/">hadith.to</a></footer>
</main></body></html>`;
