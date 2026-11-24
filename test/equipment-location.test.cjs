const test = require('node:test');
const assert = require('node:assert/strict');
const Location = require('../equipment-location.js');

test('Google Maps conserva enlaces legítimos sin consultar la red', () => {
  for (const url of ['https://www.google.com/maps?q=14.5,-90.5', 'https://maps.google.com/?q=14.5,-90.5', 'https://maps.app.goo.gl/abc', 'https://goo.gl/maps/abc', 'https://www.google.com.gt/maps/place/Test']) assert.equal(Location.normalizeMapUrl(url), url);
  assert.deepEqual(Location.coordinatesFromMapUrl('https://www.google.com/maps?q=14.5,-90.5'), { lat: 14.5, lng: -90.5 });
  assert.equal(Location.coordinatesFromMapUrl('https://maps.app.goo.gl/abc'), null);
});
test('un pin explícito prevalece sobre el centro de cámara y no inventa un pin desde @', () => {
  assert.deepEqual(Location.coordinatesFromMapUrl('https://www.google.com/maps/place/Test/@15,-91,15z/data=!8m2!3d14.5!4d-90.5'), { lat: 14.5, lng: -90.5 });
  assert.equal(Location.coordinatesFromMapUrl('https://www.google.com/maps/@15,-91,15z'), null);
  assert.equal(Location.coordinatesFromMapUrl('https://www.google.com/maps/place/%XX'), null);
});
test('enlaces de otros sitios, credenciales y protocolos peligrosos no son ubicaciones admitidas', () => {
  for (const url of ['javascript:alert(1)', 'http://google.com/maps', 'https://google.com.evil.example/maps', 'https://evil.example/maps', 'https://google.com/url?q=https://evil.example', 'https://user:pass@google.com/maps', 'https://google.com:444/maps', 'https://127.0.0.1/maps']) assert.throws(() => Location.normalizeMapUrl(url), /Google Maps/);
});
test('coordenadas válidas incluyen cero y se comparan en kilómetros de línea recta', () => {
  assert.deepEqual(Location.normalizeCoordinates({lat:0,lng:0}), {lat:0,lng:0});
  for (const value of [{lat:'',lng:0},{lat:null,lng:0},{lat:91,lng:0},{lat:0,lng:181},{lat:false,lng:0}]) assert.throws(() => Location.normalizeCoordinates(value));
  assert.ok(Math.abs(Location.distanceKm({lat:0,lng:0}, {lat:0,lng:1}) - 111.195) < 0.001);
  assert.equal(Location.distanceKm({place:'Lugar sin punto'}, {lat:0,lng:1}), null);
  assert.throws(() => Location.normalizeEventLocation({mapUrl:'https://google.com/maps?q=14,-90',location:{lat:15,lng:-91}}), /no coinciden/);
});
test('enlace de ruta usa los puntos disponibles o nombres escapados y no supone duración', () => {
  const route = new URL(Location.directionsUrl({place:'Sede A & B'}, {mapUrl:'https://google.com/maps?q=14,-90'}));
  assert.equal(route.searchParams.get('origin'), 'Sede A & B');
  assert.equal(route.searchParams.get('destination'), '14,-90');
  assert.equal(Location.directionsUrl({},{}), '');
});
