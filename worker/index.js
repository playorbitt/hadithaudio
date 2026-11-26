// Cloudflare Worker: serves the site from R2 and ports the Vercel bits
// (the /api/arabic-book-audio proxy, /h/:collection/:id redirects).
const AUDIO = {
  'aqidah-tahawiyyah': 'ar_Al3qedh_AlT7aweh_AlAnsaree.mp3',
  'alfiyyah-ibn-malik': 'ar_Alfeyyat_Ibn_Malek_Nashmi.mp3',
};
const AUDIO_BASE = 'https://github.com/playorbitt/arabic-word-reader/releases/download/Audios/';

async function audio(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const file = AUDIO[url.searchParams.get('book')];
  if (!file) return new Response(null, { status: 404 });
  const range = request.headers.get('range');
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new Response(null, { status: 416 });
  const upstream = await fetch(AUDIO_BASE + file, { method: request.method, headers: range ? { range } : {} });
  if (!upstream.ok && upstream.status !== 416) return new Response(null, { status: 502 });
  const headers = new Headers({ 'Content-Type': 'audio/mpeg' });
  for (const name of ['content-range', 'content-length', 'accept-ranges']) {
    const v = upstream.headers.get(name);
    if (v) headers.set(name, v);
  }
  if (upstream.status === 200 || upstream.status === 206) headers.set('Cache-Control', 'public, max-age=3600');
  return new Response(upstream.body, { status: upstream.status, headers });
}

// The whole site lives in R2: hadith-audio/hadithaudio/site/ (static files)
// and hadith-audio/hadithaudio/darimi/ (Darimi catalog + .m4a clips).
const IMMUTABLE = /^\/(recitation|gloss-compact|gloss-lazy)\//;
const DAILY = /^\/((bukhari|muslim|abudawud|tirmidhi|nasai|ibnmajah|malik|riyad|musnad-ahmad)\/[^/]+\.json$|translation\/|sunnah\/|[^/]+-isnad-word-pool\.json$)/;
const TYPES = { m4a: 'audio/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', json: 'application/json; charset=utf-8', html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', woff2: 'font/woff2', ttf: 'font/ttf', txt: 'text/plain; charset=utf-8', xml: 'application/xml', webmanifest: 'application/manifest+json', gz: 'application/gzip' };

function candidates(path) {
  const base = path.startsWith('/darimi/') ? 'hadithaudio' : 'hadithaudio/site';
  if (path.endsWith('/')) return [base + path + 'index.html'];
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (last.includes('.')) return [base + path];
  return [base + path + '.html', base + path + '/index.html'];
}

async function serve(request, env, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return new Response('Bad request', { status: 400 }); }
  if (path.includes('..')) return new Response('Bad request', { status: 400 });
  let obj, key;
  for (key of candidates(path)) {
    obj = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
    if (obj) break;
  }
  return obj ? respond(request, obj, key, path) : notFound(env, url, path);
}

async function serveKey(request, env, key, path) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const obj = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
  return obj ? respond(request, obj, key, path) : new Response('Not found', { status: 404 });
}

async function notFound(env, url, path) {
  {
    // "/foo" that is really a folder → redirect to "/foo/"
    if (!path.endsWith('/') && !path.slice(path.lastIndexOf('/') + 1).includes('.')) {
      const dir = await env.MEDIA.head('hadithaudio/site' + path + '/index.html');
      if (dir) return Response.redirect(url.origin + path + '/' + url.search, 308);
    }
    return new Response('Not found', { status: 404 });
  }
}

function respond(request, obj, key, path) {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  const ext = key.slice(key.lastIndexOf('.') + 1);
  if (TYPES[ext]) headers.set('content-type', TYPES[ext]);
  headers.set('cache-control', IMMUTABLE.test(path) ? 'public, max-age=31536000, immutable'
    : DAILY.test(path) ? 'public, max-age=86400, stale-while-revalidate=604800'
    : ext === 'html' ? 'public, max-age=0, must-revalidate' : 'public, max-age=3600');
  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  let status = 200;
  if (obj.range) {
    const { offset = 0, length = obj.size - offset } = obj.range.suffix != null
      ? { offset: obj.size - obj.range.suffix, length: obj.range.suffix } : obj.range;
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set('content-length', String(length));
    status = 206;
  } else headers.set('content-length', String(obj.size));
  return new Response(request.method === 'HEAD' ? null : obj.body, { status, headers });
}

// cdn.hadith.to: map the old CDN paths onto the hadith.to backup in R2
// (hadith-audio/hadith-to/{audio,timings}/<collection>/<record>.<ext>).
const FORTY = { 'nawawi-arbain': 'nawawi40', 'qudsi-arbain': 'qudsi40', 'shahwaliullah-arbain': 'shahwaliullah40' };
function cdnKey(path) {
  if (/^\/(bukhari|muslim)-urdu\/[\w.-]+\.(mp3|m4a|json)$/.test(path)) return path.slice(1);
  let m = path.match(/^\/recitation\/([a-z-]+)\.(\d+)\.(mp3|m4a|json)$/);
  if (m && FORTY[m[1]]) return m[3] === 'json'
    ? `hadithaudio/site/recitation/${m[1]}.${m[2]}.json`
    : `hadith-to/audio/${FORTY[m[1]]}/${+m[2]}.${m[3]}`;
  m = path.match(/^\/([a-z-]+)-timings\/[nr]?(\d+)(?:\.json)?$/);
  if (m) return `hadith-to/timings/${m[1]}/${+m[2]}.json`;
  m = path.match(/^\/([a-z-]+)\/[nr]?(\d+)\.(mp3|ogg|m4a)$/);
  if (m) return `hadith-to/audio/${m[1]}/${+m[2]}.${m[3]}`;
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'cdn.hadith.to') {
      const key = cdnKey(url.pathname);
      const res = key ? await serveKey(request, env, key, url.pathname) : new Response('Not found', { status: 404 });
      res.headers.set('access-control-allow-origin', '*');
      return res;
    }
    if (url.pathname === '/api/arabic-book-audio') return audio(request, url);
    const h = url.pathname.match(/^\/h\/([^/]+)\/([^/]+)\/?$/);
    if (h) return Response.redirect(`${url.origin}/?c=${h[1]}&n=${h[2]}`, 308);
    return serve(request, env, url);
  },
};
