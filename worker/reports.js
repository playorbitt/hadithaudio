// POST /v1/reports — "Report an error" submissions from hadith.to, stored in
// D1 database hadith-reports (table reports). Read them in the Cloudflare
// dashboard: Storage & Databases → D1 → hadith-reports → Console, e.g.
//   SELECT * FROM reports WHERE status='open' ORDER BY created_at DESC;
const COLLECTIONS = new Set([
  'bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik', 'darimi', 'musnad-ahmad',
  'ibn-khuzaymah', 'al-ilmam', 'bulugh-al-maram', 'al-lulu-wal-marjan', 'al-muntaqa-ibn-al-jarud',
  'al-adab-al-mufrad', 'riyad', 'umdat-al-ahkam', 'nawawi40', 'qudsi40', 'shahwaliullah40', 'shamail',
]);
const TYPES = new Set(['arabic_text', 'audio_unavailable', 'wrong_audio', 'audio_cut', 'word_timing', 'metadata', 'translation', 'other']);
const SEVERITIES = new Set(['low', 'normal', 'high', 'critical']);
const ALLOWED_ORIGINS = new Set(['https://hadith.to', 'https://www.hadith.to']);
const MAX_PER_HOUR = 20;

function cors(request) {
  const origin = request.headers.get('origin');
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://hadith.to',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}
const reply = (request, status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(request) },
});
const str = (v, max) => (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, max) : null;
const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

async function hashIp(ip) {
  const day = new Date().toISOString().slice(0, 10);   // rotates daily; raw IPs are never stored
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}:${ip}`));
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleReports(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
  if (request.method !== 'POST') return reply(request, 405, { error: 'Method not allowed' });
  if (Number(request.headers.get('content-length') || 0) > 20000) return reply(request, 413, { error: 'Report too large' });
  let b;
  try { b = await request.json(); } catch { return reply(request, 400, { error: 'Invalid JSON' }); }
  if (!b || typeof b !== 'object') return reply(request, 400, { error: 'Invalid JSON' });
  if (!COLLECTIONS.has(b.collection)) return reply(request, 400, { error: 'Invalid collection' });
  const hadith = str(b.hadithNumber, 20);
  if (!hadith || !/^\d+[a-z]?$/i.test(hadith)) return reply(request, 400, { error: 'Invalid hadith number' });
  if (!TYPES.has(b.errorType)) return reply(request, 400, { error: 'Invalid error type' });
  if (!SEVERITIES.has(b.severity)) return reply(request, 400, { error: 'Invalid severity' });

  const id = crypto.randomUUID();
  // Honeypot field ("website") is hidden from people; bots fill it. Pretend success.
  if (typeof b.website === 'string' && b.website.trim()) return reply(request, 201, { reportId: id });

  const ip = request.headers.get('cf-connecting-ip') || '';
  const ipHash = await hashIp(ip);
  const recent = await env.REPORTS.prepare(
    "SELECT COUNT(*) AS n FROM reports WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')",
  ).bind(ipHash).first();
  if (recent && recent.n >= MAX_PER_HOUR) return reply(request, 429, { error: 'Too many reports, please try later' });

  const context = Array.isArray(b.context) ? JSON.stringify(b.context.slice(0, 12)).slice(0, 4000) : null;
  await env.REPORTS.prepare(`INSERT INTO reports (id, collection, hadith_number, book_number, error_type, severity, note,
      page_url, audio_url, timing_url, playback_time, token_id, token_text, token_start, token_end, context,
      user_agent, country, ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    id, b.collection, hadith, str(b.bookNumber, 20), b.errorType, b.severity, str(b.note, 4000),
    str(b.pageUrl, 500), str(b.audioUrl, 500), str(b.timingUrl, 500), num(b.playbackTime),
    str(b.tokenId, 200), str(b.tokenText, 200), num(b.tokenStart), num(b.tokenEnd), context,
    str(request.headers.get('user-agent'), 300), str(request.cf?.country, 8), ipHash,
  ).run();
  return reply(request, 201, { reportId: id });
}
