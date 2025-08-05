// Utility functions for repetitive group recommendations

export const getRepetitiveGroupRecommendation = (group) => {
  const upperGroup = group?.toUpperCase();
  
  // Groups A-I: Low nitrogen load
  if (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].includes(upperGroup)) {
    return "Tu carga de nitrógeno es baja; tómatelo con calma, hidrátate y sigue con tu día normalmente.";
  }
  
  // Groups J-R: Some nitrogen in tissues
  if (['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'].includes(upperGroup)) {
    return "Tienes algo de nitrógeno en los tejidos; evita movimientos bruscos, dedica este rato a descansar y a hidratarte.";
  }
  
  // Groups S-Z: High residual nitrogen
  if (['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].includes(upperGroup)) {
    return "Tu nivel de nitrógeno residual es bastante alto; quédate tranquilo, mantén reposo e hidrátate bien antes de hacer cualquier actividad.";
  }
  
  // Fallback for unknown groups
  return "Consulta las recomendaciones de seguridad para tu grupo repetitivo.";
};

export const getOrdinalInSpanish = (index) => {
  const ordinals = [
    "Primera parada",
    "Segunda parada", 
    "Tercera parada",
    "Cuarta parada",
    "Quinta parada",
    "Sexta parada",
    "Séptima parada",
    "Octava parada",
    "Novena parada",
    "Décima parada"
  ];
  
  return ordinals[index] || `Parada ${index + 1}`;
};