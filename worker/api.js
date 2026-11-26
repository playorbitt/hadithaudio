// api.hadith.to/v1 — read-only Hadith API, rebuilt on the hadith.to backup in R2
// (hadith-audio/hadith-to/records/<collection>/<record>.json, manifest/collections.json).
const VERSION = 'v1';
const PREFIX = 'hadith-to';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, HEAD, OPTIONS' };

function json(body, status = 200, cache = 'public, max-age=3600') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache, ...CORS },
  });
}
const error = (status, code, message) => json({ error: { code, message } }, status, 'no-store');

let collectionsCache;
async function collections(env) {
  if (!collectionsCache) {
    const obj = await env.MEDIA.get(`${PREFIX}/manifest/collections.json`);
    if (!obj) throw new Error('collections manifest missing');
    collectionsCache = await obj.json();
  }
  return collectionsCache;
}

async function loadRecord(env, collection, record) {
  const obj = await env.MEDIA.get(`${PREFIX}/records/${collection}/${record}.json`);
  return obj ? obj.json() : null;
}

function shape(raw, collection, record, includeTimings) {
  const { wordTimings, tokens, links, ...rest } = raw;
  const out = {
    ...rest,
    collection,
    record,
    tokens: (tokens || []).map((t, i) => ({ id: t.id, position: i + 1, text: t.text })),
    media: raw.media || { available: false, audio: null, timings: null },
    links: { website: `https://hadith.to/#${collection}:${record}`, self: `/${VERSION}/hadith/${collection}/${record}` },
  };
  // "wordTimings" is what the original API returned (hadith.dev relies on it);
  // "timings" matches the v1 docs. Keep both.
  if (includeTimings) { out.wordTimings = wordTimings || null; out.timings = out.wordTimings; }
  return out;
}

async function parse(env, parts) {
  const [collection, recordText] = parts;
  const list = await collections(env);
  const meta = list.find((c) => c.id === collection);
  if (!meta) return { err: error(404, 'collection_not_found', 'Unknown collection.') };
  if (!/^[1-9]\d{0,6}$/.test(recordText || '')) return { err: error(400, 'invalid_record', 'Record must be a positive integer.') };
  const record = Number(recordText);
  if (record > meta.records) return { err: error(404, 'record_not_found', 'Record is outside this collection.') };
  return { collection, record, meta };
}

export async function handleApi(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET' && request.method !== 'HEAD') return error(405, 'method_not_allowed', 'Only GET is supported.');
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '' || path === `/${VERSION}`) {
    return json({ name: 'Hadith API', version: VERSION, docs: 'https://api.hadith.to/v1',
      endpoints: ['/v1/health', '/v1/collections', '/v1/hadith/{collection}/{record}', '/v1/audio/{collection}/{record}'] });
  }
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== VERSION) return error(404, 'not_found', 'Unknown endpoint.');
  const [, endpoint, ...args] = parts;
  try {
    if (endpoint === 'health' && !args.length) {
      await collections(env);
      return json({ status: 'ok', version: VERSION }, 200, 'no-store');
    }
    if (endpoint === 'collections' && !args.length) {
      return json({ collections: await collections(env) });
    }
    if ((endpoint === 'hadith' || endpoint === 'audio') && args.length === 2) {
      const p = await parse(env, args);
      if (p.err) return p.err;
      const raw = await loadRecord(env, p.collection, p.record);
      if (!raw) return error(404, 'record_not_found', 'Record is outside this collection.');
      if (endpoint === 'audio') {
        const media = raw.media || { available: false, audio: null, timings: null };
        const out = { collection: p.collection, record: p.record, ...media };
        if (p.meta.synthetic) { out.synthetic = true; out.synthesisDisclosure = raw.synthesisDisclosure || null; }
        return json(out);
      }
      return json(shape(raw, p.collection, p.record, url.searchParams.get('include') === 'timings'));
    }
    return error(404, 'not_found', 'Unknown endpoint.');
  } catch (e) {
    return error(502, 'source_unavailable', 'Canonical source temporarily unavailable.');
  }
}
