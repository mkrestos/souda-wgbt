export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const station = (requestUrl.searchParams.get("station") || "LGSA").toUpperCase();

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=60"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!/^[A-Z0-9]{4}$/.test(station)) {
      return Response.json({ error: "Invalid ICAO station." }, { status: 400, headers: corsHeaders });
    }

    const awcUrl =
      `https://aviationweather.gov/api/data/metar?ids=${station}&format=json&hours=2`;

    const response = await fetch(awcUrl, {
      headers: {
        "User-Agent": "Personal-WBGT-Planner/1.0",
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return Response.json(
        { error: `Aviation Weather API returned ${response.status}` },
        { status: 502, headers: corsHeaders }
      );
    }

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json(
        { error: `No recent METAR available for ${station}` },
        { status: 404, headers: corsHeaders }
      );
    }

    const m = rows[0];

    // AWC JSON generally supplies temp/dewp in °C, wind in knots,
    // and altim in hPa. The fallbacks make the proxy tolerant of field changes.
    const tempC = Number(m.temp);
    const dewC = Number(m.dewp);
    const windKt = Number(m.wspd || 0);
    const altimeterRaw = Number(m.altim);
    const altimeterHpa = altimeterRaw < 100
      ? altimeterRaw * 33.8638867
      : altimeterRaw;

    const output = {
      station,
      observationTime:
        m.reportTime || m.obsTime || m.receiptTime || new Date().toISOString(),
      temperatureC: tempC,
      temperatureF: tempC * 9 / 5 + 32,
      dewPointC: dewC,
      dewPointF: dewC * 9 / 5 + 32,
      windKnots: windKt,
      windMph: windKt * 1.15077945,
      windDirectionDeg: m.wdir,
      altimeterHpa,
      rawMetar: m.rawOb || m.raw_text || null,
      source: "NOAA/NWS Aviation Weather Center METAR API"
    };

    return Response.json(output, { headers: corsHeaders });
  }
};
