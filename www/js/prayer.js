// Fajr-time lookup (Aladhan API, ISNA method by default) with local caching so the
// morning reminder can be scheduled relative to Fajr instead of a fixed clock time.
const Prayer = (() => {
  const CACHE_KEY = 'wfa.fajrCache.v1';

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveCache(c) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

  function cacheKeyFor(settings) {
    const p = settings.prayer;
    return `${p.city}|${p.country}|${p.method}`;
  }

  // Fetches the whole month (cheap: one call) for city/month/year via Aladhan.
  async function fetchMonth(city, country, method, year, month) {
    const url = `https://api.aladhan.com/v1/calendarByCity/${year}/${month}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('prayer api error ' + res.status);
    const json = await res.json();
    const days = {};
    (json.data || []).forEach(entry => {
      const dateStr = entry.date.gregorian.date; // DD-MM-YYYY
      const [dd, mm, yyyy] = dateStr.split('-');
      const key = `${yyyy}-${mm}-${dd}`;
      const fajrRaw = entry.timings.Fajr || '';
      const time = fajrRaw.split(' ')[0]; // strip "(CST)" etc
      days[key] = time;
    });
    return days;
  }

  // Ensures the cache covers today..+15 days for the current settings; re-fetches
  // only when the city/method changed or the cache is stale/missing a needed day.
  async function refresh(settings) {
    const key = cacheKeyFor(settings);
    let cache = loadCache();
    if (cache.key !== key) cache = { key, days: {}, fetchedAt: 0 };

    const today = new Date();
    const horizon = new Date(); horizon.setDate(horizon.getDate() + 15);
    const neededMonths = new Set([
      `${today.getFullYear()}-${today.getMonth()+1}`,
      `${horizon.getFullYear()}-${horizon.getMonth()+1}`,
    ]);

    const staleCache = (Date.now() - (cache.fetchedAt || 0)) > 20 * 86400000; // refetch every ~20 days
    const missingDays = [...Array(15)].some((_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      return !cache.days[ymd(d)];
    });

    if (!staleCache && !missingDays) return cache.days;

    try {
      for (const ym of neededMonths) {
        const [y, m] = ym.split('-');
        const monthDays = await fetchMonth(settings.prayer.city, settings.prayer.country, settings.prayer.method, y, m);
        Object.assign(cache.days, monthDays);
      }
      cache.fetchedAt = Date.now();
      saveCache(cache);
    } catch (e) {
      console.warn('Fajr fetch failed, using whatever is cached', e);
    }
    return cache.days;
  }

  // Returns 'HH:MM' Fajr time for a given Date, or null if not in cache.
  function fajrFor(date, days) {
    return (days || loadCache().days || {})[ymd(date)] || null;
  }

  function addMinutes(hhmm, minutes) {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const wrapped = ((total % 1440) + 1440) % 1440;
    return pad(Math.floor(wrapped / 60)) + ':' + pad(wrapped % 60);
  }

  return { refresh, fajrFor, addMinutes, ymd };
})();
