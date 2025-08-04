// Datos simulados para desarrollo
export const mockDecompressionTable = [
  {
    "Profundidad (m)": 12.2,
    "Tiempo de Fondo (min)": 170,
    "Tiempo hasta la primera parada": "00:00:40",
    "Parada 6.1m": 6.0,
    "Tiempo Total Ascenso (min)": "00:07:20",
    "Grupo Repetición": "O"
  },
  {
    "Profundidad (m)": 15.2,
    "Tiempo de Fondo (min)": 120,
    "Parada 6.1m": 21.0,
    "Tiempo Total Ascenso (min)": "00:22:40",
    "Grupo Repetición": "O"
  },
  {
    "Profundidad (m)": 18.3,
    "Tiempo de Fondo (min)": 80,
    "Parada 6.1m": 15.0,
    "Tiempo Total Ascenso (min)": "00:17:50",
    "Grupo Repetición": "O"
  },
  {
    "Profundidad (m)": 24.4,
    "Tiempo de Fondo (min)": 45,
    "Parada 9.1m": 2.0,
    "Parada 6.1m": 25.0,
    "Tiempo Total Ascenso (min)": "00:30:20",
    "Grupo Repetición": "Z"
  },
  {
    "Profundidad (m)": 30.5,
    "Tiempo de Fondo (min)": 25,
    "Parada 6.1m": 0.0,
    "Tiempo Total Ascenso (min)": "00:03:20",
    "Grupo Repetición": "N"
  }
];

// Función de cálculo simulada
export const mockCalculateDecompression = (depth, bottomTime, altitude, breathingGas, oxygenDeco) => {
  // Encontrar la entrada apropiada en la tabla simulada (lógica simplificada)
  const roundedDepth = Math.ceil(depth / 3) * 3; // Redondear a la profundidad disponible más cercana
  const roundedTime = Math.ceil(bottomTime / 10) * 10; // Redondear al tiempo disponible más cercano
  
  // Lógica simulada simple - devolver diferentes resultados basados en la profundidad
  if (depth <= 10) {
    return {
      noDecompressionDive: true,
      decompressionStops: [],
      actualInputs: { depth, bottomTime },
      roundedValues: { depth: roundedDepth, time: roundedTime },
      tableUsed: "US Navy Rev 7 – Tabla de Aire I",
      altitude,
      breathingGas,
      oxygenDeco,
      totalAscentTime: "00:01:30",
      repetitiveGroup: "A"
    };
  } else if (depth <= 20) {
    return {
      noDecompressionDive: false,
      decompressionStops: [
        { depth: 6.1, duration: 15 }
      ],
      actualInputs: { depth, bottomTime },
      roundedValues: { depth: roundedDepth, time: roundedTime },
      tableUsed: "US Navy Rev 7 – Tabla de Aire I",
      altitude,
      breathingGas,
      oxygenDeco,
      totalAscentTime: "00:17:30",
      repetitiveGroup: "O"
    };
  } else {
    return {
      noDecompressionDive: false,
      decompressionStops: [
        { depth: 9.1, duration: 2 },
        { depth: 6.1, duration: 25 }
      ],
      actualInputs: { depth, bottomTime },
      roundedValues: { depth: roundedDepth, time: roundedTime },
      tableUsed: "US Navy Rev 7 – Tabla de Aire I",
      altitude,
      breathingGas,
      oxygenDeco,
      totalAscentTime: "00:30:20",
      repetitiveGroup: "Z"
    };
  }
};