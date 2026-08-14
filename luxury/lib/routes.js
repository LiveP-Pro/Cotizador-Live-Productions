function normalizeGuatemalaAddress(address) {
  const value = String(address || "").trim();
  if (!value) return "";
  return /guatemala/i.test(value) ? value : `${value}, Guatemala`;
}

function parseDuration(value) {
  const seconds = Number(String(value || "0s").replace("s", ""));
  return Math.max(1, Math.ceil(seconds / 60));
}

async function googleRoute(origin, destination, apiKey) {
  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.localizedValues",
      },
      body: JSON.stringify({
        origin: { address: normalizeGuatemalaAddress(origin) },
        destination: { address: normalizeGuatemalaAddress(destination) },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "es-419",
        units: "METRIC",
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.routes?.[0]) {
    throw new Error(payload.error?.message || "Google Routes no devolvió una ruta.");
  }
  const route = payload.routes[0];
  return {
    kilometers: Math.round((route.distanceMeters / 1000) * 10) / 10,
    minutes: parseDuration(route.duration),
    provider: "Google Routes API",
  };
}

async function geocode(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", normalizeGuatemalaAddress(address));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "gt");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: { "User-Agent": "LuxuryTravelManager/1.0 (reservas@luxurytravel.gt)" },
  });
  const result = await response.json();
  if (!response.ok || !result[0]) {
    throw new Error(`No se encontró la dirección: ${address}`);
  }
  return [Number(result[0].lon), Number(result[0].lat)];
}

async function openRouteService(origin, destination) {
  const [from, to] = await Promise.all([geocode(origin), geocode(destination)]);
  const url = `https://router.project-osrm.org/route/v1/driving/${from.join(",")};${to.join(",")}?overview=false`;
  const response = await fetch(url, {
    headers: { "User-Agent": "LuxuryTravelManager/1.0" },
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== "Ok" || !payload.routes?.[0]) {
    throw new Error("No fue posible calcular la ruta alternativa.");
  }
  return {
    kilometers: Math.round((payload.routes[0].distance / 1000) * 10) / 10,
    minutes: Math.max(1, Math.ceil(payload.routes[0].duration / 60)),
    provider: "OpenStreetMap / OSRM",
  };
}

export async function calculateRoute(origin, destination, options = {}) {
  if (!origin || !destination) {
    throw new Error("El punto de salida y el destino son obligatorios.");
  }
  if (options.googleApiKey) {
    return googleRoute(origin, destination, options.googleApiKey);
  }
  if (options.allowFallback) {
    return openRouteService(origin, destination);
  }
  throw new Error(
    "Configure GOOGLE_MAPS_API_KEY para calcular rutas automáticamente.",
  );
}
