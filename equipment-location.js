(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EquipmentLocation = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const text = value => String(value ?? '').trim();
  const fail = message => Object.assign(new Error(message), { statusCode: 400 });
  function normalizeMapUrl(value) {
    const literal = text(value);
    if (!literal) return '';
    if (literal.length > 4096) throw fail('El enlace de Google Maps es demasiado largo.');
    let url;
    try { url = new URL(literal); } catch (_) { throw fail('Use un enlace HTTPS válido de Google Maps.'); }
    const host = url.hostname.toLowerCase();
    const google = /^(?:(?:www|maps)\.)?google\.(?:com|es|com\.gt|com\.mx|com\.sv|com\.hn|co\.cr|com\.pa|com\.co)$/.test(host);
    const short = host === 'maps.app.goo.gl' || host === 'goo.gl' && /^\/maps(?:\/|$)/.test(url.pathname);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !(short || google && (host.startsWith('maps.') || /^\/maps(?:\/|$)/.test(url.pathname)))) throw fail('Use un enlace HTTPS de Google Maps; no se admiten otros sitios.');
    return url.href;
  }
  function normalizeCoordinates(value) {
    if (value === undefined || value === null || value === '') return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('La ubicación necesita latitud y longitud válidas.');
    const rawLat = value.lat ?? value.latitude, rawLng = value.lng ?? value.longitude;
    if (![rawLat, rawLng].every(raw => ['number', 'string'].includes(typeof raw) && text(raw) !== '' && Number.isFinite(Number(raw)))) throw fail('La ubicación necesita latitud y longitud válidas.');
    const lat = Number(rawLat), lng = Number(rawLng);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw fail('La latitud o longitud queda fuera del rango válido.');
    return { lat, lng };
  }
  function coordinatesFromMapUrl(value) {
    const literal = normalizeMapUrl(value);
    if (!literal) return null;
    const url = new URL(literal);
    const parse = value => {
      const match = text(value).match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (!match) return null;
      try { return normalizeCoordinates({ lat: match[1], lng: match[2] }); } catch (_) { return null; }
    };
    // A map's @latitude,longitude is its camera centre, not necessarily the
    // event's pin. Use explicit query coordinates or the place's 3d/4d pin.
    for (const name of ['query', 'q', 'destination']) {
      const result = parse(url.searchParams.get(name));
      if (result) return result;
    }
    let path = url.pathname + url.search + url.hash;
    try { path = decodeURIComponent(path); } catch (_) { /* Invalid escapes are never location evidence. */ }
    const pin = path.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    return pin ? parse(`${pin[1]},${pin[2]}`) : null;
  }
  function coordinates(value) {
    if (!value) return null;
    if (value.lat !== undefined || value.latitude !== undefined) return normalizeCoordinates(value);
    return normalizeCoordinates(value.location || value.coordinates) || coordinatesFromMapUrl(value.mapUrl || '');
  }
  function normalizeEventLocation(raw = {}) {
    const mapUrl = normalizeMapUrl(raw.mapUrl);
    const explicit = normalizeCoordinates(raw.location || raw.coordinates);
    const pinned = coordinatesFromMapUrl(mapUrl);
    // Keep the pin as location evidence when available. Merely pasting a
    // shortened link never triggers a server fetch or invents coordinates.
    if (explicit && pinned && distanceKm(explicit, pinned) > 0.1) throw fail('La ubicación escrita y el pin de Google Maps no coinciden. Revise el lugar del evento.');
    const location = pinned || explicit;
    return { mapUrl, ...(location ? { location } : {}) };
  }
  function distanceKm(from, to) {
    const a = coordinates(from), b = coordinates(to);
    if (!a || !b) return null;
    const radians = value => value * Math.PI / 180;
    const dLat = radians(b.lat - a.lat), dLng = radians(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  }
  function directionsUrl(from, to) {
    const value = event => { const point = coordinates(event); return point ? `${point.lat},${point.lng}` : text(event?.place || event?.name); };
    const origin = value(from), destination = value(to);
    return origin && destination ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving` : '';
  }
  return Object.freeze({ normalizeMapUrl, normalizeCoordinates, coordinatesFromMapUrl, coordinates, normalizeEventLocation, distanceKm, directionsUrl });
});
