#!/usr/bin/env node
require('dotenv').config();
const { connect, disconnect } = require('../src/config/database');
const AemetAlert = require('../src/models/AemetAlert');

async function callApi(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function run() {
  const apiHost = process.env.LOCAL_API_HOST || 'http://localhost:3000';
  const endpoint = `${apiHost}/api/aemet-alerts`;

  console.log('Conectando a MongoDB...');
  await connect();

  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log('\n--- Tiempo de referencia ---');
  console.log(`Hora local del sistema: ${now.toString()}`);
  console.log(`Hora UTC: ${now.toISOString()}`);
  console.log(`Zona horaria detectada: ${timeZone}`);

  console.log(`Llamando API (sin refresh): ${endpoint}`);
  const respA = await callApi(endpoint);
  console.log(`Llamando API (con refresh): ${endpoint}?refresh=true`);
  const respB = await callApi(`${endpoint}?refresh=true`);
  console.log('Respuesta raw respA:', (respA && respA.error) ? respA : (Array.isArray(respA) ? `Array(${respA.length})` : typeof respA));
  console.log('Respuesta raw respB:', (respB && respB.error) ? respB : (Array.isArray(respB) ? `Array(${respB.length})` : typeof respB));

  // Consultas directas en BD
  console.log('\n--- Comparación con la BD ---');
  console.log('Se compara cada documento con este instante: validez_fin < now => expirada');
  console.log(`now usado en la consulta: ${now.toISOString()}`);
  const expired = await AemetAlert.find({ validez_fin: { $lt: now } }).lean();
  const active = await AemetAlert.find({ validez_fin: { $gte: now } }).lean();
  console.log(`Consulta expiradas: { validez_fin: { $lt: ${now.toISOString()} } }`);
  console.log(`Consulta activas: { validez_fin: { $gte: ${now.toISOString()} } }`);

  function extractArray(resp) {
    if (!resp) return null;
    if (Array.isArray(resp)) return resp;
    if (resp.data && Array.isArray(resp.data)) return resp.data;
    return null;
  }

  const arrA = extractArray(respA);
  const arrB = extractArray(respB);

  const respAIds = arrA ? arrA.map(r => r.aemet_id || r.id || r._id) : [];
  const respBIds = arrB ? arrB.map(r => r.aemet_id || r.id || r._id) : [];

  const expiredIds = new Set(expired.map(d => d.aemet_id));
  const activeIds = new Set(active.map(d => d.aemet_id));

  const respA_expired = respAIds.filter(id => id && expiredIds.has(id));
  const respA_activeNotInDb = respAIds.filter(id => id && !activeIds.has(id) && !expiredIds.has(id));

  const respB_expired = respBIds.filter(id => id && expiredIds.has(id));
  const respB_activeNotInDb = respBIds.filter(id => id && !activeIds.has(id) && !expiredIds.has(id));

  console.log('\n--- Informe rápido ---');
  console.log(`Alertas en BD (expiradas): ${expired.length}`);
  console.log(`Alertas en BD (activas): ${active.length}`);
  console.log(`Respuesta API (sin refresh): ${arrA ? arrA.length : 'error'}`);
  console.log(`Respuesta API (con refresh): ${arrB ? arrB.length : 'error'}`);

  if (expired.length > 0) {
    console.log('\nEjemplos de alertas expiradas en BD:');
    expired.slice(0, 5).forEach(alert => {
      console.log(`- ${alert.aemet_id} | ${alert.zona || 'sin zona'} | fin=${alert.validez_fin?.toISOString?.() || alert.validez_fin}`);
    });
  }

  if (active.length > 0) {
    console.log('\nEjemplos de alertas activas en BD:');
    active.slice(0, 5).forEach(alert => {
      console.log(`- ${alert.aemet_id} | ${alert.zona || 'sin zona'} | fin=${alert.validez_fin?.toISOString?.() || alert.validez_fin}`);
    });
  }

  if (respA_expired.length > 0) {
    console.log('\nAlertas expiradas presentes en resp-A (sin refresh):');
    console.log(respA_expired.slice(0, 50));
  } else {
    console.log('\nNo hay alertas expiradas en resp-A');
  }

  if (respB_expired.length > 0) {
    console.log('\nAlertas expiradas presentes en resp-B (con refresh):');
    console.log(respB_expired.slice(0, 50));
  } else {
    console.log('\nNo hay alertas expiradas en resp-B');
  }

  console.log('\nIDs en resp-A que no aparecen en BD (posible desincronización):', respA_activeNotInDb.slice(0,50));
  console.log('IDs en resp-B que no aparecen en BD (posible desincronización):', respB_activeNotInDb.slice(0,50));

  await disconnect();
}

run().catch(err => {
  console.error('Error en script:', err);
  process.exit(1);
});
