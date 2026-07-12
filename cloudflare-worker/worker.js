export default {
  async fetch(request) {
    const u=new URL(request.url),station=(u.searchParams.get("station")||"LGSA").toUpperCase();
    const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Cache-Control":"public, max-age=60"};
    if(request.method==="OPTIONS")return new Response(null,{headers});
    if(!/^[A-Z0-9]{4}$/.test(station))return Response.json({error:"Invalid ICAO station."},{status:400,headers});
    const awc=`https://aviationweather.gov/api/data/metar?ids=${station}&format=json&hours=2`;
    const res=await fetch(awc,{headers:{"User-Agent":"Personal-WBGT-Planner/2.0","Accept":"application/json"}});
    if(!res.ok)return Response.json({error:`Aviation Weather API returned ${res.status}`},{status:502,headers});
    const rows=await res.json();
    if(!Array.isArray(rows)||!rows.length)return Response.json({error:`No recent METAR for ${station}`},{status:404,headers});
    const m=rows[0],tempC=Number(m.temp),dewC=Number(m.dewp),windKt=Number(m.wspd||0),alt=Number(m.altim);
    const altimeterHpa=alt<100?alt*33.8638867:alt;
    return Response.json({
      station,observationTime:m.reportTime||m.obsTime||m.receiptTime||new Date().toISOString(),
      temperatureC:tempC,temperatureF:tempC*9/5+32,dewPointC:dewC,dewPointF:dewC*9/5+32,
      windKnots:windKt,windMph:windKt*1.15077945,windDirectionDeg:m.wdir,altimeterHpa,
      rawMetar:m.rawOb||m.raw_text||null,source:"NOAA/NWS Aviation Weather Center METAR API"
    },{headers});
  }
};