/** Link do oddzielnej mapy Targeo w środku i przybliżeniu bieżącego widoku. */
export function linkTargeo(lon:number,lat:number,resolution:number) {
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||!Number.isFinite(resolution)||resolution<=0 || lon < -180 || lon > 180 || lat < -85 || lat > 85) return undefined;
 const zoom=Math.max(7,Math.min(20,Math.round(Math.log2(156543.033928*Math.cos(lat*Math.PI/180)/resolution))));
 return `https://mapa.targeo.pl/,${zoom},${lon.toFixed(7)},${lat.toFixed(7)}`;
}
