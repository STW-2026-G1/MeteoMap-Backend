#!/usr/bin/env node

const aemetAlertsService = require("../src/services/aemetAlertsService");

function almostEqual(a, b, epsilon = 1e-9) {
  return Math.abs(a - b) <= epsilon;
}

function matchesExpected(result, expected) {
  if (expected.latitud === null || expected.longitud === null) {
    return result.latitud === null && result.longitud === null;
  }

  return (
    typeof result.latitud === "number" &&
    typeof result.longitud === "number" &&
    almostEqual(result.latitud, expected.latitud) &&
    almostEqual(result.longitud, expected.longitud)
  );
}

function runTests() {
  const tests = [
    {
      name: "Rectangulo simple",
      polygon: "40,-4 40,-2 42,-2 42,-4",
      expected: { latitud: 41, longitud: -3 },
      note: "Centroide medio de 4 vertices",
    },
    {
      name: "Poligono irregular",
      polygon: "43,-5 42,-3 40,-2 39,-4 41,-6",
      expected: { latitud: 41, longitud: -4 },
      note: "Promedio de vertices validos",
    },
    {
      name: "Con puntos invalidos",
      polygon: "abc,2 91,0 40,-3 42,-1",
      expected: { latitud: 41, longitud: -2 },
      note: "Descarta no numericos y fuera de rango",
    },
    {
      name: "Multipoligono en array",
      polygon: ["10,10 10,20 20,20 20,10", "30,30 30,40 40,40 40,30"],
      expected: { latitud: 15, longitud: 15 },
      note: "Usa solo el primer poligono del array",
    },
    {
      name: "Poligono vacio",
      polygon: "",
      expected: { latitud: null, longitud: null },
      note: "Fallback por entrada vacia",
    },
    {
      name: "Poligono nulo",
      polygon: null,
      expected: { latitud: null, longitud: null },
      note: "Fallback por entrada nula",
    },
  ];

  console.log("=== Test de _parseAemetPolygon ===");
  console.log("Calcula coordenadas como punto medio estimado (centroide simple)");
  console.log("");

  let passed = 0;

  tests.forEach((test, index) => {
    const result = aemetAlertsService._parseAemetPolygon(
      test.polygon,
      `test-${index + 1}`,
      "amarillo"
    );

    const ok = matchesExpected(result, test.expected);
    if (ok) passed += 1;

    console.log(`[${ok ? "OK" : "FAIL"}] ${test.name}`);
    console.log(`  Nota: ${test.note}`);
    console.log(
      `  Esperado: lat=${test.expected.latitud}, lon=${test.expected.longitud}`
    );
    console.log(`  Obtenido: lat=${result.latitud}, lon=${result.longitud}`);
    console.log("");
  });

  console.log(`Resultado final: ${passed}/${tests.length} tests correctos`);

  if (passed !== tests.length) {
    process.exitCode = 1;
  }
}

runTests();
