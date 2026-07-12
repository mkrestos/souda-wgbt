
let deferredPrompt = null;

const $ = id => document.getElementById(id);
const num = id => Number($(id).value);

function populateLookups() {
  for (const name of Object.keys(WBGT.scenarios)) {
    const opt = document.createElement("option");
    opt.value = opt.textContent = name;
    $("skyScenario").appendChild(opt);
  }
  $("skyScenario").value = "Clear strong sun";

  for (const name of Object.keys(WBGT.surfaces)) {
    const opt = document.createElement("option");
    opt.value = opt.textContent = name;
    $("surfaceType").appendChild(opt);
  }
  $("surfaceType").value = "Weathered concrete apron";
}

function updateFlagDisplay(flag) {
  const badge = $("flagBadge");
  badge.textContent = `${flag} Flag`;
  badge.className = `flag-badge flag-${flag.toLowerCase()}`;
}

function recalculate() {
  try {
    const tempF = num("tempF");
    const dewF = num("dewF");
    const pressureHpa = num("pressureHpa");
    let rh = num("rh");

    if (!Number.isFinite(rh) || rh <= 0 || rh > 100) {
      rh = WBGT.relativeHumidityFromDewPoint(tempF, dewF);
      $("rh").value = rh.toFixed(1);
    }

    const naturalWetF = WBGT.naturalWetBulbIterative(tempF, dewF, pressureHpa);
    const stullWetF = WBGT.stullWetBulb(tempF, rh);

    const exposure = $("exposure").value;
    const solarMode = $("solarMode").value;
    let solar = 0;
    if (exposure === "Direct sun") {
      if (solarMode === "Live") solar = num("liveSolar");
      else if (solarMode === "Scenario") solar = WBGT.scenarios[$("skyScenario").value];
      else solar = num("manualSolar");
    }

    const wind = $("windMode").value === "Live" ? num("liveWind") : num("manualWind");
    const albedo = WBGT.surfaces[$("surfaceType").value];

    const modeledGlobeF = WBGT.modeledGlobeTemperature({
      tempF, solarWm2: solar, windMph: wind, albedo
    });
    const measuredGlobeRaw = $("measuredGlobe").value.trim();
    const globeF = measuredGlobeRaw === "" ? modeledGlobeF : Number(measuredGlobeRaw);

    const estimatedWbgt = WBGT.calculateWbgt({
      exposure, naturalWetF, globeF, dryBulbF: tempF
    });

    const officialRaw = $("officialWbgt").value.trim();
    const controllingWbgt = officialRaw === "" ? estimatedWbgt : Number(officialRaw);
    const flag = WBGT.flagFromWbgt(controllingWbgt);

    $("naturalWet").textContent = naturalWetF.toFixed(1);
    $("stullWet").textContent = stullWetF.toFixed(1);
    $("globeTemp").textContent = globeF.toFixed(1);
    $("solarUsed").textContent = solar.toFixed(0);
    $("windUsed").textContent = wind.toFixed(1);
    $("estimatedWbgt").textContent = estimatedWbgt.toFixed(1);
    $("wbgtValue").textContent = controllingWbgt.toFixed(1);
    $("confidenceLabel").textContent = officialRaw === "" ? "Estimated" : "Measured / official";
    $("guidanceText").textContent = WBGT.guidance(flag);
    updateFlagDisplay(flag);
  } catch (err) {
    $("weatherStatus").textContent = err.message;
  }
}

async function fetchWeather() {
  const lat = num("latitude");
  const lon = num("longitude");
  $("weatherStatus").textContent = "Fetching current weather…";

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,shortwave_radiation,wind_speed_10m",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto"
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error(`Weather request failed (${response.status}).`);
  const data = await response.json();
  const c = data.current;

  $("tempF").value = Number(c.temperature_2m).toFixed(1);
  $("dewF").value = Number(c.dew_point_2m).toFixed(1);
  $("rh").value = Number(c.relative_humidity_2m).toFixed(1);
  $("pressureHpa").value = Number(c.surface_pressure).toFixed(1);
  $("liveSolar").value = Number(c.shortwave_radiation).toFixed(0);
  $("liveWind").value = Number(c.wind_speed_10m).toFixed(1);
  $("updatedAt").textContent = `Updated ${c.time}`;
  $("weatherStatus").textContent = "Live weather loaded.";
  recalculate();
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    $("weatherStatus").textContent = "Geolocation is not supported on this device.";
    return;
  }
  $("weatherStatus").textContent = "Requesting location…";
  navigator.geolocation.getCurrentPosition(
    pos => {
      $("latitude").value = pos.coords.latitude.toFixed(6);
      $("longitude").value = pos.coords.longitude.toFixed(6);
      fetchWeather().catch(err => $("weatherStatus").textContent = err.message);
    },
    err => $("weatherStatus").textContent = `Location unavailable: ${err.message}`,
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
  );
}

function wireEvents() {
  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", recalculate);
    el.addEventListener("change", recalculate);
  });
  $("useLocationBtn").addEventListener("click", useCurrentLocation);
  $("refreshBtn").addEventListener("click", () => {
    fetchWeather().catch(err => $("weatherStatus").textContent = err.message);
  });
  $("manualModeBtn").addEventListener("click", () => {
    $("solarMode").value = "Manual";
    $("windMode").value = "Manual";
    $("weatherStatus").textContent = "Manual mode selected.";
    recalculate();
  });

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    $("installBtn").classList.remove("hidden");
  });
  $("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("installBtn").classList.add("hidden");
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

populateLookups();
wireEvents();
recalculate();
