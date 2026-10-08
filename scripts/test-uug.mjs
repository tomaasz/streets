import assert from 'node:assert/strict';
import {odczytajUug} from './lib/uug.mjs';

const street={street:'Jadowska',city:'Kamieńczyk',teryt:'143505',simc:'0522939',ulic:'07011',x:'21.55',y:'52.59',geometry_wkt:'MULTILINESTRING((21.54 52.60,21.55 52.59))'};
const read=(r)=>odczytajUug({type:'street',results:{1:r}},['0522939']);
assert.equal(read(street)[0].id,'uug-0522939-07011');
assert.deepEqual(odczytajUug({type:'street',results:null},['0522939']),[]);
assert.deepEqual(odczytajUug({type:'address',results:{1:street}},['0522939']),[]);
for(const override of [
 {teryt:'143504'}, {simc:'9999999'}, {ulic:'bad'}, {city:null},
 {geometry_wkt:'POINT(21.55 52.59)'}, {x:'500000',y:'600000'},
 {geometry_wkt:'LINESTRING(0 0,21.55 52.59)'},
 {geometry_wkt:'LINESTRING(21.55 52.59)'},
]) assert.deepEqual(read({...street,...override}),[],JSON.stringify(override));
assert.equal(odczytajUug({type:'street',results:{1:street,2:street}},['0522939']).length,1);
console.log('UUG: walidacja identyfikatorów, zakresu geometrii i duplikatów OK');
