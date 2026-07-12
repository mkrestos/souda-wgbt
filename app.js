let deferredPrompt=null;
let observationDate=new Date();
let currentSourceLabel="Manual inputs";
let currentMetarAge=null;
let currentForecast=[];
let latestSelectedWbgt=null;

const $=id=>document.getElementById(id);
const num=id=>Number($(id).value);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function populateLookups(){
  Object.keys(WBGT.scenarios).forEach(name=>{const o=document.createElement("option");o.value=o.textContent=name;$("skyScenario").appendChild(o);});
  $("skyScenario").value="Clear strong sun";
  Object.keys(WBGT.surfaces).forEach(name=>{const o=document.createElement("option");o.value=o.textContent=name;$("surfaceType").appendChild(o);});
  $("surfaceType").value="Weathered concrete apron";
}
function updateFlagDisplay(flag){const b=$("flagBadge");b.textContent=`${flag} Flag`;b.className=`flag-badge flag-${flag.toLowerCase()}`;}
function setMiniFlag(id,flag){const el=$(id);el.textContent=flag;el.className=`mini-flag flag-${flag.toLowerCase()}`;}

function getSolarUsed(){
  if($("exposure").value!=="Direct sun") return 0;
  return $("solarMode").value==="Live"?num("liveSolar"):
    $("solarMode").value==="Scenario"?WBGT.scenarios[$("skyScenario").value]:num("manualSolar");
}
function getWindUsed(){return $("windMode").value==="Live"?num("liveWind"):num("manualWind");}

function computeCurrent(){
  const tempF=num("tempF"),dewF=num("dewF"),pressureHpa=num("pressureHpa");
  let rh=num("rh");
  if(!Number.isFinite(rh)||rh<=0||rh>100){rh=WBGT.relativeHumidityFromDewPoint(tempF,dewF);$("rh").value=rh.toFixed(1);}
  const exposure=$("exposure").value,solar=getSolarUsed(),wind=getWindUsed(),albedo=WBGT.surfaces[$("surfaceType").value];
  const psychWet=WBGT.naturalWetBulbIterative(tempF,dewF,pressureHpa);
  const stull=WBGT.stullWetBulb(tempF,rh);
  const simpGlobe=WBGT.modeledGlobeTemperature({tempF,solarWm2:solar,windMph:wind,albedo});
  const globeRaw=$("measuredGlobe").value.trim();
  const simpGlobeUsed=globeRaw===""?simpGlobe:Number(globeRaw);
  const simplifiedWbgt=WBGT.calculateWbgt({exposure,naturalWetF:psychWet,globeF:simpGlobeUsed,dryBulbF:tempF});
  const lil=WBGT.liljegren({tempF,rh,pressureHpa,windMph:wind,windHeightM:10,solarWm2:solar,
    latitude:num("latitude"),longitude:num("longitude"),date:observationDate,albedo,exposure});
  return {tempF,dewF,rh,pressureHpa,exposure,solar,wind,albedo,psychWet,stull,simpGlobeUsed,simplifiedWbgt,lil};
}

function confidenceAssessment(result){
  let score=80;
  const notes=[];
  if(currentSourceLabel.includes("LGSA")){score+=8;notes.push("Measured METAR atmosphere");}
  else if(currentSourceLabel.includes("Open-Meteo")){score+=2;notes.push("Modeled atmosphere");}
  else {score-=15;notes.push("Manual inputs");}
  if($("solarMode").value==="Live"){score+=3;notes.push("Live solar model");}
  else if($("solarMode").value==="Scenario"){score-=7;notes.push("Scenario solar");}
  if($("windMode").value==="Manual"){score+=2;notes.push("Local wind entered");}
  const spread=Math.abs(result.lil.wbgtF-result.simplifiedWbgt);
  if(spread>3){score-=15;notes.push("Large model spread");}
  else if(spread>1.5){score-=7;notes.push("Moderate model spread");}
  const age=currentMetarAge==null?0:currentMetarAge;
  if(age>90){score-=15;notes.push("Stale METAR");}
  else if(age>45){score-=7;notes.push("Aging METAR");}
  score=clamp(score,20,95);
  const level=score>=85?"High":score>=70?"Moderate":score>=50?"Low":"Very low";
  return {score,level,spread,notes:notes.join("; ")||"Standard inputs"};
}

function updateSiteEstimates(base){
  const sites=[["flightLine","siteFlightLil","siteFlightSimple","siteFlightFlag"],["marathi","siteMarathiLil","siteMarathiSimple","siteMarathiFlag"],["softball","siteSoftballLil","siteSoftballSimple","siteSoftballFlag"],["fuelFarm","siteFuelLil","siteFuelSimple","siteFuelFlag"]];
  for(const [key,lilId,simpleId,flagId] of sites){
    const r=WBGT.siteEstimate(WBGT.siteProfiles[key],base);
    $(lilId).textContent=`${r.liljegrenWbgt.toFixed(1)}°F`;
    $(simpleId).textContent=`${r.simplifiedWbgt.toFixed(1)}°F`;
    setMiniFlag(flagId,r.flag);
  }
}

function recalculate(){
  try{
    const r=computeCurrent();
    const selected=$("modelChoice").value==="liljegren"?r.lil.wbgtF:r.simplifiedWbgt;
    const officialRaw=$("officialWbgt").value.trim();
    const controlling=officialRaw===""?selected:Number(officialRaw);
    const flag=WBGT.flagFromWbgt(controlling);
    latestSelectedWbgt=selected;

    $("naturalWet").textContent=r.psychWet.toFixed(1);
    $("stullWet").textContent=r.stull.toFixed(1);
    $("globeTemp").textContent=r.simpGlobeUsed.toFixed(1);
    $("simplifiedWbgt").textContent=r.simplifiedWbgt.toFixed(1);
    $("lilNaturalWet").textContent=r.lil.naturalWetF.toFixed(1);
    $("lilGlobeTemp").textContent=r.lil.globeF.toFixed(1);
    $("lilWbgt").textContent=r.lil.wbgtF.toFixed(1);
    $("modelDifference").textContent=(r.lil.wbgtF-r.simplifiedWbgt).toFixed(1);
    $("solarUsed").textContent=r.solar.toFixed(0);
    $("windUsed").textContent=r.wind.toFixed(1);
    $("sourceUsed").textContent=currentSourceLabel;
    $("sourceUsedHero").textContent=currentSourceLabel;
    $("metarAge").textContent=currentMetarAge==null?"--":currentMetarAge.toFixed(0);
    $("wbgtValue").textContent=controlling.toFixed(1);
    $("confidenceLabel").textContent=officialRaw!==""?"Measured / official":($("modelChoice").value==="liljegren"?"Liljegren estimate":"Simplified estimate");
    $("guidanceText").textContent=WBGT.guidance(flag);
    updateFlagDisplay(flag);

    updateSiteEstimates({tempF:r.tempF,dewF:r.dewF,rh:r.rh,pressureHpa:r.pressureHpa,windMph:r.wind,solarWm2:r.solar,
      latitude:num("latitude"),longitude:num("longitude"),date:observationDate});

    const conf=confidenceAssessment(r);
    $("confidenceScore").textContent=`${conf.level} (${conf.score})`;
    $("dataAge").textContent=currentMetarAge==null?"--":currentMetarAge.toFixed(0);
    $("spreadValue").textContent=conf.spread.toFixed(1);
    $("qualityNote").textContent=conf.notes;

    const d=WBGT.psychrometricDiagnostics(r.tempF,r.dewF,r.pressureHpa);
    $("engVaporPressure").textContent=d.vaporPressure.toFixed(3);
    $("engPsychCoeff").textContent=d.psychrometricCoefficient.toFixed(6);
    $("engCza").textContent=r.lil.cza.toFixed(4);
    $("engFdir").textContent=r.lil.directFraction.toFixed(3);
    $("engWind2m").textContent=r.lil.wind2mMph.toFixed(2);
    $("engAlbedo").textContent=r.albedo.toFixed(2);
  }catch(err){$("weatherStatus").textContent=err.message;}
}

async function fetchOpenMeteo(lat,lon,full=true,forecast=false){
  const currentFields=full?"temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,shortwave_radiation,wind_speed_10m":"shortwave_radiation";
  const hourlyFields=forecast?"temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,shortwave_radiation,wind_speed_10m":"";
  const params=new URLSearchParams({latitude:lat,longitude:lon,current:currentFields,temperature_unit:"fahrenheit",wind_speed_unit:"mph",timezone:"auto"});
  if(forecast) params.set("hourly",hourlyFields);
  const res=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if(!res.ok) throw new Error(`Open-Meteo request failed (${res.status}).`);
  return res.json();
}
async function fetchLgsaMetar() {
  const proxy =
    "https://souda-wgbt.mkrestos.workers.dev/";

  const u = new URL(proxy);
  u.searchParams.set("station", "LGSA");

  const res = await fetch(u.toString());

  if (!res.ok) {
    throw new Error(
      `METAR proxy request failed (${res.status}).`
    );
  }

  return res.json();
}
async function fetchWeather(){
  $("weatherStatus").textContent="Fetching current weather…";
  const source=$("weatherSource").value;
  if(source==="manual"){currentSourceLabel="Manual inputs";currentMetarAge=null;observationDate=new Date();recalculate();return;}
  if(source==="lgsa"){
    const LGSA={lat:35.5317,lon:24.1497};
    const [metar,solar]=await Promise.all([fetchLgsaMetar(),fetchOpenMeteo(LGSA.lat,LGSA.lon,false,false)]);
    $("tempF").value=Number(metar.temperatureF).toFixed(1);
    $("dewF").value=Number(metar.dewPointF).toFixed(1);
    $("rh").value=WBGT.relativeHumidityFromDewPoint(Number(metar.temperatureF),Number(metar.dewPointF)).toFixed(1);
    $("pressureHpa").value=Number(metar.stationPressureHpa||metar.altimeterHpa).toFixed(1);
    $("liveWind").value=Number(metar.windMph).toFixed(1);
    $("liveSolar").value=Number(solar.current.shortwave_radiation).toFixed(0);
    observationDate=new Date(metar.observationTime);
    currentMetarAge=Math.max(0,(Date.now()-observationDate.getTime())/60000);
    currentSourceLabel="LGSA METAR + modeled solar";
    $("updatedAt").textContent=`LGSA ${metar.observationTime}`;
  }else{
    const data=await fetchOpenMeteo(num("latitude"),num("longitude"),true,false),c=data.current;
    $("tempF").value=Number(c.temperature_2m).toFixed(1);$("dewF").value=Number(c.dew_point_2m).toFixed(1);
    $("rh").value=Number(c.relative_humidity_2m).toFixed(1);$("pressureHpa").value=Number(c.surface_pressure).toFixed(1);
    $("liveSolar").value=Number(c.shortwave_radiation).toFixed(0);$("liveWind").value=Number(c.wind_speed_10m).toFixed(1);
    observationDate=new Date();currentMetarAge=null;currentSourceLabel="Open-Meteo at selected coordinates";
    $("updatedAt").textContent=`Updated ${c.time}`;
  }
  $("weatherStatus").textContent="Weather loaded.";recalculate();
}

function drawForecast(points){
  const canvas=$("forecastChart"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.font="12px sans-serif";ctx.fillStyle="#5d7180";
  if(!points.length){ctx.fillText("No forecast loaded.",20,30);return;}
  const vals=points.map(p=>p.wbgt),min=Math.floor(Math.min(...vals)-2),max=Math.ceil(Math.max(...vals)+2);
  const pad={l:45,r:20,t:20,b:45},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  ctx.strokeStyle="#d8e2e8";ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=pad.t+ch*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
    const v=max-(max-min)*i/4;ctx.fillText(v.toFixed(0),8,y+4);}
  ctx.strokeStyle="#2f7da2";ctx.lineWidth=3;ctx.beginPath();
  points.forEach((p,i)=>{const x=pad.l+cw*i/(points.length-1||1);const y=pad.t+ch*(max-p.wbgt)/(max-min||1);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
  ctx.stroke();
  points.forEach((p,i)=>{if(i%2===0){const x=pad.l+cw*i/(points.length-1||1);ctx.fillStyle="#5d7180";ctx.fillText(p.label,x-14,h-18);}});
}
function renderForecastTable(points){
  const rows=points.map(p=>`<tr><td>${p.label}</td><td>${p.wbgt.toFixed(1)}°F</td><td>${WBGT.flagFromWbgt(p.wbgt)}</td></tr>`).join("");
  $("forecastTableWrap").innerHTML=`<table class="site-table"><thead><tr><th>Time</th><th>WBGT</th><th>Flag</th></tr></thead><tbody>${rows}</tbody></table>`;
}
async function loadForecast(){
  $("weatherStatus").textContent="Loading hourly forecast…";
  const lat=num("latitude"),lon=num("longitude"),data=await fetchOpenMeteo(lat,lon,true,true),h=data.hourly;
  const now=Date.now();const points=[];
  for(let i=0;i<h.time.length&&points.length<12;i++){
    const dt=new Date(h.time[i]);if(dt.getTime()<now-3600000)continue;
    const lil=WBGT.liljegren({tempF:h.temperature_2m[i],rh:h.relative_humidity_2m[i],pressureHpa:h.surface_pressure[i],
      windMph:h.wind_speed_10m[i],windHeightM:10,solarWm2:h.shortwave_radiation[i],latitude:lat,longitude:lon,date:dt,
      albedo:WBGT.surfaces[$("surfaceType").value],exposure:$("exposure").value});
    points.push({label:dt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),wbgt:lil.wbgtF});
  }
  currentForecast=points;drawForecast(points);renderForecastTable(points);$("weatherStatus").textContent="Forecast loaded.";
}

function useCurrentLocation(){
  if(!navigator.geolocation){$("weatherStatus").textContent="Geolocation not supported.";return;}
  navigator.geolocation.getCurrentPosition(p=>{$("latitude").value=p.coords.latitude.toFixed(6);$("longitude").value=p.coords.longitude.toFixed(6);fetchWeather().catch(e=>$("weatherStatus").textContent=e.message);},
    e=>$("weatherStatus").textContent=`Location unavailable: ${e.message}`,{enableHighAccuracy:true,timeout:12000,maximumAge:300000});
}
function saveSettings(){
  const ids=["weatherSource","metarProxyUrl","latitude","longitude","modelChoice","exposure","solarMode","skyScenario","surfaceType","manualSolar","windMode","manualWind"];
  const obj={};ids.forEach(id=>obj[id]=$(id).value);localStorage.setItem("wbgtSettings",JSON.stringify(obj));$("weatherStatus").textContent="Settings saved.";
}
function loadSettings(){
  try{const obj=JSON.parse(localStorage.getItem("wbgtSettings")||"{}");Object.entries(obj).forEach(([id,v])=>{if($(id))$(id).value=v;});}catch{}
}
function getValidationLog(){return JSON.parse(localStorage.getItem("wbgtValidation")||"[]");}
function setValidationLog(log){localStorage.setItem("wbgtValidation",JSON.stringify(log));}
function renderValidation(){
  const log=getValidationLog();
  if(!log.length){$("validationStats").textContent="No measurements logged.";$("validationTableWrap").innerHTML="";return;}
  const errors=log.map(x=>x.predicted-x.measured),mae=errors.reduce((a,b)=>a+Math.abs(b),0)/errors.length,bias=errors.reduce((a,b)=>a+b,0)/errors.length;
  $("validationStats").textContent=`n=${log.length}; MAE ${mae.toFixed(2)}°F; bias ${bias.toFixed(2)}°F`;
  $("validationTableWrap").innerHTML=`<table class="site-table"><thead><tr><th>Date</th><th>Location</th><th>Predicted</th><th>Measured</th><th>Error</th></tr></thead><tbody>${
    log.map(x=>`<tr><td>${x.date}</td><td>${x.location}</td><td>${x.predicted.toFixed(1)}</td><td>${x.measured.toFixed(1)}</td><td>${(x.predicted-x.measured).toFixed(1)}</td></tr>`).join("")
  }</tbody></table>`;
}
function addValidation(){
  const measured=num("validationMeasured");if(!Number.isFinite(measured)||latestSelectedWbgt==null)return;
  const log=getValidationLog();log.push({date:new Date().toISOString(),location:$("validationLocation").value||"Unknown",predicted:latestSelectedWbgt,measured});
  setValidationLog(log);renderValidation();
}
function exportValidation(){
  const log=getValidationLog();if(!log.length)return;
  const csv=["date,location,predicted_f,measured_f,error_f",...log.map(x=>`${x.date},"${x.location.replaceAll('"','""')}",${x.predicted},${x.measured},${x.predicted-x.measured}`)].join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="wbgt-validation.csv";a.click();URL.revokeObjectURL(a.href);
}

function wireEvents(){
  document.querySelectorAll("input,select").forEach(el=>{el.addEventListener("input",recalculate);el.addEventListener("change",recalculate);});
  $("useLocationBtn").addEventListener("click",useCurrentLocation);
  $("refreshBtn").addEventListener("click",()=>fetchWeather().catch(e=>$("weatherStatus").textContent=e.message));
  $("saveSettingsBtn").addEventListener("click",saveSettings);
  $("loadForecastBtn").addEventListener("click",()=>loadForecast().catch(e=>$("weatherStatus").textContent=e.message));
  $("addValidationBtn").addEventListener("click",addValidation);
  $("exportValidationBtn").addEventListener("click",exportValidation);
  $("clearValidationBtn").addEventListener("click",()=>{localStorage.removeItem("wbgtValidation");renderValidation();});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden");});
  $("installBtn").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").classList.add("hidden");});
}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js"));
populateLookups();loadSettings();wireEvents();renderValidation();recalculate();drawForecast([]);
