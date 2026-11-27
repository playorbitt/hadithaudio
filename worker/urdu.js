// Urdu audio for Bukhari and Muslim, read from the site's own data in R2
// (hadithaudio/site/<collection>/urdu/...). Each Urdu recording covers many
// hadith, so a hadith is a segment [start, end] inside one audio file.
const SITE = 'hadithaudio/site';
const URDU = { bukhari: { gz: false }, muslim: { gz: true } };
const CDN = 'https://cdn.hadith.to';
const cache = new Map();

async function readJson(env, key, gz) {
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const obj = await env.MEDIA.get(key);
    if (!obj) return null;
    if (!gz) return obj.json();
    const stream = obj.body.pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).json();
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return p;
}

export const hasUrdu = (collection) => Object.hasOwn(URDU, collection);

// Returns null when this hadith has no Urdu recording.
export async function urduMedia(env, collection, record, includeTimings) {
  const cfg = URDU[collection];
  if (!cfg) return null;
  const main = await readJson(env, `${SITE}/${collection}/index.json`, false);
  const book = main?.reportBook?.[String(record)];
  if (!book) return null;
  const ext = cfg.gz ? '.json.gz' : '.json';
  const [index, data] = await Promise.all([
    readJson(env, `${SITE}/${collection}/urdu/index${ext}`, cfg.gz),
    readJson(env, `${SITE}/${collection}/urdu/book-${book}${ext}`, cfg.gz),
  ]);
  const row = data?.hadith?.[String(record)];
  if (!index || !row || !(row.e > row.s && row.s >= 0)) return null;

  const out = {
    language: 'ur',
    audio: `${CDN}/${collection}-urdu/${row.f}`,
    start: row.s,
    end: row.e,
  };
  if (includeTimings) {
    // Bukhari rows store word times either against the whole file or against
    // the segment; normalise to whole-file seconds (same rule as the reader).
    const duration = row.e - row.s;
    const absolute = collection !== 'bukhari'
      || row.w.some(([, a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > duration);
    out.tokens = row.w.map(([text, a, b], i) => {
      const t = { position: i + 1, text };
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
        const start = absolute ? a : a + row.s;
        const end = absolute ? b : b + row.s;
        if (start >= row.s - 0.01 && end <= row.e + 0.01) { t.start = start; t.end = end; }
      }
      return t;
    });
  }
  return out;
}
