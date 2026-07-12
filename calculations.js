
const WBGT = (() => {
  const scenarios = {
    "Night / no sun": 0,
    "Deep shade": 50,
    "Heavy overcast": 125,
    "Overcast": 250,
    "Broken clouds": 500,
    "Hazy / filtered sun": 650,
    "Mostly sunny": 800,
    "Clear strong sun": 950,
    "Extreme clear midday": 1050
  };

  const surfaces = {
    "Dark asphalt": 0.10,
    "Weathered concrete apron": 0.25,
    "Light concrete / pale pavement": 0.35,
    "Dry grass / soil": 0.20,
    "Green grass": 0.23,
    "White roof / very bright surface": 0.60
  };

  const fToC = f => (f - 32) * 5 / 9;
  const cToF = c => c * 9 / 5 + 32;

  function saturationVaporPressure(tempC) {
    return 6.112 * Math.exp((17.62 * tempC) / (243.12 + tempC));
  }

  function relativeHumidityFromDewPoint(tempF, dewF) {
    const t = fToC(tempF);
    const td = fToC(dewF);
    return 100 * saturationVaporPressure(td) / saturationVaporPressure(t);
  }

  function naturalWetBulbIterative(tempF, dewF, pressureHpa) {
    const t = fToC(tempF);
    const td = fToC(dewF);
    if (td > t) throw new Error("Dew point cannot exceed air temperature.");
    const actualVaporPressure = saturationVaporPressure(td);

    let lower = td;
    let upper = t;
    for (let i = 0; i < 50; i++) {
      const tw = (lower + upper) / 2;
      const psychrometricCoefficient = 0.00066 * (1 + 0.00115 * tw);
      const calculatedVaporPressure =
        saturationVaporPressure(tw) -
        psychrometricCoefficient * pressureHpa * (t - tw);

      if (calculatedVaporPressure > actualVaporPressure) upper = tw;
      else lower = tw;
    }
    return cToF((lower + upper) / 2);
  }

  function stullWetBulb(tempF, rh) {
    const t = fToC(tempF);
    const result =
      t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
      Math.atan(t + rh) -
      Math.atan(rh - 1.676331) +
      0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
      4.686035;
    return cToF(result);
  }

  function modeledGlobeTemperature({ tempF, solarWm2, windMph, albedo }) {
    const taC = fToC(tempF);
    const taK = taC + 273.15;
    const diameter = 0.15;
    const absorptivity = 0.95;
    const emissivity = 0.95;
    const sigma = 5.670374419e-8;
    const windMs = Math.max(windMph * 0.44704, 0.1);

    const reflectedMultiplier = 1 + 0.5 * albedo;
    const absorbedSolar = absorptivity * solarWm2 * reflectedMultiplier / 4;
    const forcedH = 6.3 * Math.pow(windMs, 0.6) / Math.pow(diameter, 0.4);

    let lower = taC;
    let upper = taC + 80;

    for (let i = 0; i < 50; i++) {
      const tgC = (lower + upper) / 2;
      const naturalH = 1.4 * Math.pow(Math.max(Math.abs(tgC - taC), 0.0001), 0.25);
      const h = Math.max(forcedH, naturalH);
      const losses =
        emissivity * sigma * (Math.pow(tgC + 273.15, 4) - Math.pow(taK, 4)) +
        h * (tgC - taC);
      const net = absorbedSolar - losses;
      if (net > 0) lower = tgC;
      else upper = tgC;
    }
    return cToF((lower + upper) / 2);
  }

  function calculateWbgt({ exposure, naturalWetF, globeF, dryBulbF }) {
    if (exposure === "Direct sun") {
      return 0.7 * naturalWetF + 0.2 * globeF + 0.1 * dryBulbF;
    }
    return 0.7 * naturalWetF + 0.3 * globeF;
  }

  function flagFromWbgt(wbgtF) {
    if (wbgtF < 80) return "White";
    if (wbgtF < 85) return "Green";
    if (wbgtF < 88) return "Yellow";
    if (wbgtF < 90) return "Red";
    return "Black";
  }

  function guidance(flag) {
    const map = {
      White: "Below Navy flag thresholds, but very intense exertion can still cause heat illness.",
      Green: "Use discretion for heavy exercise, especially for unacclimatized personnel.",
      Yellow: "Curtail strenuous exercise for unacclimatized personnel.",
      Red: "Curtail strenuous exercise for personnel not sufficiently acclimatized to hot-weather training.",
      Black: "Suspend physical training and strenuous exercise; follow local command policy and medical guidance."
    };
    return map[flag] || "No guidance available.";
  }

  return {
    scenarios, surfaces, relativeHumidityFromDewPoint,
    naturalWetBulbIterative, stullWetBulb,
    modeledGlobeTemperature, calculateWbgt,
    flagFromWbgt, guidance
  };
})();
