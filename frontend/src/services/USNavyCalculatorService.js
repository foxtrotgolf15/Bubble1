import tabla1 from '../tables/tabla_1.json';
import tabla2_1 from '../tables/tabla_2_1.json';
import tabla2_2 from '../tables/tabla_2_2.json';
import tabla3 from '../tables/tabla_3.json';
import tabla4 from '../tables/tabla_4.json';

class USNavyCalculatorService {
  constructor() {
    this.tabla1 = tabla1;
    this.tabla2_1 = tabla2_1;
    this.tabla2_2 = tabla2_2;
    this.tabla3 = tabla3;
    this.tabla4 = tabla4;
  }

  /**
   * Calculate barometric pressure at altitude using the barometric formula
   */
  calculateBarometricPressure(altitudeMeters) {
    const pSeaLevel = 1013.25; // hPa
    const temperature = 288.15; // K
    const lapseRate = 0.0065; // K/m
    const exponent = 5.255;
    
    return pSeaLevel * Math.pow((1 - (lapseRate * altitudeMeters) / temperature), exponent);
  }

  /**
   * Calculate equivalent depth for altitude diving
   */
  calculateEquivalentDepth(realDepth, altitudeMeters, recalibrated = false) {
    if (altitudeMeters === 0) {
      return { realDepth, equivalentDepth: realDepth };
    }

    let adjustedDepth = realDepth;
    
    // If not recalibrated, add depth correction (+0.3m per 304.32m altitude)
    if (!recalibrated) {
      const depthCorrection = (altitudeMeters / 304.32) * 0.3;
      adjustedDepth = realDepth + depthCorrection;
    }

    // Apply barometric pressure correction
    const pSeaLevel = 1013.25;
    const pAltitude = this.calculateBarometricPressure(altitudeMeters);
    const equivalentDepth = adjustedDepth * (pSeaLevel / pAltitude);

    return {
      realDepth,
      equivalentDepth: parseFloat(equivalentDepth.toFixed(1))
    };
  }

  /**
   * Find matching entry in tabla_1 based on mode, depth, and time
   * Rules: mode flag = "Si", depth = exact or next deeper, bottom time = exact or next longer
   */
  findTable1Entry(mode, depth, bottomTime) {
    const modeFieldMap = {
      'aire': 'Descompresion con aire',
      'o2_agua': 'Descompresion con O2 en el agua ',
      'surdo2': 'Descompresion en superficie'
    };

    const modeField = modeFieldMap[mode];
    
    // Find entries where the mode flag is "Si"
    const validEntries = this.tabla1.filter(entry => entry[modeField] === 'Si');
    
    if (validEntries.length === 0) {
      return { success: false, alternativeModes: this.findAlternativeModes(depth, bottomTime, mode) };
    }

    // Find exact or next deeper depth
    const depthEntries = validEntries.filter(entry => 
      entry['Profundidad (m)'] >= depth
    );
    
    if (depthEntries.length === 0) {
      return { success: false, alternativeModes: this.findAlternativeModes(depth, bottomTime, mode) };
    }

    // Sort by depth and get entries for the smallest applicable depth
    depthEntries.sort((a, b) => a['Profundidad (m)'] - b['Profundidad (m)']);
    const targetDepth = depthEntries[0]['Profundidad (m)'];
    const depthMatchEntries = depthEntries.filter(entry => 
      entry['Profundidad (m)'] === targetDepth
    );

    // Find exact or next longer time
    const timeEntries = depthMatchEntries.filter(entry => 
      entry['Tiempo de Fondo (min)'] >= bottomTime
    );
    
    if (timeEntries.length === 0) {
      return { success: false, alternativeModes: this.findAlternativeModes(depth, bottomTime, mode) };
    }

    // Sort by time and get the smallest applicable time
    timeEntries.sort((a, b) => a['Tiempo de Fondo (min)'] - b['Tiempo de Fondo (min)']);
    
    return { success: true, entry: timeEntries[0] };
  }

  /**
   * Find alternative modes for a given depth/time combination
   */
  findAlternativeModes(depth, bottomTime, currentMode) {
    const modes = ['aire', 'o2_agua', 'surdo2'];
    const alternatives = [];

    modes.forEach(mode => {
      if (mode !== currentMode) {
        const result = this.findTable1Entry(mode, depth, bottomTime);
        if (result.success) {
          alternatives.push(mode);
        }
      }
    });

    return alternatives;
  }

  /**
   * Check if dive requires no decompression stops
   */
  isNoDecompressionDive(entry) {
    const flags = [
      entry['Descompresion con aire'],
      entry['Descompresion con O2 en el agua '],
      entry['Descompresion en superficie']
    ];
    
    return flags.every(flag => flag === 'No');
  }

  /**
   * Extract stop information from table entry
   */
  extractStops(entry) {
    const stops = [];
    const stopFields = [
      'Parada 39.6m', 'Parada 36.6m', 'Parada 33.5m', 'Parada 30.5m',
      'Parada 27.4m', 'Parada 24.4m', 'Parada 21.3m', 'Parada 18.3m',
      'Parada 15.2m', 'Parada 12.2m', 'Parada 9.1m', 'Parada 6.1m'
    ];

    stopFields.forEach(field => {
      if (entry[field] && entry[field] > 0) {
        const depth = parseFloat(field.replace('Parada ', '').replace('m', ''));
        stops.push({ depth, time: entry[field] });
      }
    });

    // Sort stops by depth (deepest first)
    stops.sort((a, b) => b.depth - a.depth);
    return stops;
  }

  /**
   * Generate timeline for air decompression
   */
  generateAirDecompressionTimeline(entry, realDepth) {
    const timeline = [];
    let currentDepth = realDepth;
    let totalTime = 0;
    
    const stops = this.extractStops(entry);

    stops.forEach((stop, index) => {
      // Ascent to stop at 9 m/min
      const ascentDistance = currentDepth - stop.depth;
      if (ascentDistance > 0) {
        const ascentTime = (ascentDistance / 9) * 60; // Convert to seconds
        timeline.push({
          type: 'ascent',
          fromDepth: currentDepth,
          toDepth: stop.depth,
          time: ascentTime,
          speed: 9,
          gas: 'Aire',
          description: `Ascenso de ${currentDepth}m a ${stop.depth}m (9 m/min)`
        });
        totalTime += ascentTime;
      }

      // Decompression stop
      const stopTimeSeconds = stop.time * 60;
      timeline.push({
        type: 'stop',
        depth: stop.depth,
        time: stopTimeSeconds,
        gas: 'Aire',
        description: `Parada de descompresión en ${stop.depth}m`
      });
      totalTime += stopTimeSeconds;
      currentDepth = stop.depth;
    });

    // Final ascent to surface at 9 m/min
    if (currentDepth > 0) {
      const finalAscentTime = (currentDepth / 9) * 60;
      timeline.push({
        type: 'ascent',
        fromDepth: currentDepth,
        toDepth: 0,
        time: finalAscentTime,
        speed: 9,
        gas: 'Aire',
        description: `Ascenso final a superficie (9 m/min)`
      });
      totalTime += finalAscentTime;
    }

    return { timeline, totalTime };
  }

  /**
   * Calculate O₂ segments with 30-min periods and 5-min air breaks
   */
  calculateO2Segments(totalO2Time) {
    const segments = [];
    let remainingTime = totalO2Time;
    let periodCount = 0;

    while (remainingTime > 0) {
      periodCount++;
      
      if (remainingTime <= 35) {
        // Final segment ≤35 min, no break required
        segments.push({
          type: 'o2_period',
          time: remainingTime,
          gas: 'O₂',
          description: `Período ${periodCount} de O₂ - ${remainingTime} min`
        });
        remainingTime = 0;
      } else {
        // 30-minute O₂ period
        segments.push({
          type: 'o2_period',
          time: 30,
          gas: 'O₂',
          description: `Período ${periodCount} de O₂ - 30 min`
        });
        
        // 5-minute air break (not counted toward O₂ time)
        segments.push({
          type: 'air_break',
          time: 5,
          gas: 'Aire',
          description: `Descanso con aire - 5 min`
        });
        
        remainingTime -= 30;
      }
    }

    const totalStopTime = segments.reduce((sum, segment) => sum + segment.time, 0);
    
    return { segments, totalStopTime };
  }

  /**
   * Generate timeline for O₂ in water decompression
   */
  generateO2WaterDecompressionTimeline(entry, realDepth) {
    const timeline = [];
    let currentDepth = realDepth;
    let totalTime = 0;
    
    const stops = this.extractStops(entry);

    stops.forEach((stop, index) => {
      // Ascent to stop at 9 m/min
      const ascentDistance = currentDepth - stop.depth;
      if (ascentDistance > 0) {
        const ascentTime = (ascentDistance / 9) * 60;
        timeline.push({
          type: 'ascent',
          fromDepth: currentDepth,
          toDepth: stop.depth,
          time: ascentTime,
          speed: 9,
          gas: 'Aire',
          description: `Ascenso de ${currentDepth}m a ${stop.depth}m (9 m/min)`
        });
        totalTime += ascentTime;
      }

      // Determine gas type: O₂ at 9m and 6m, Air for deeper stops
      const gas = (stop.depth <= 9) ? 'O₂' : 'Aire';

      if (gas === 'O₂') {
        // Add Travel/Shift/Vent period before O₂
        timeline.push({
          type: 'travel_shift_vent',
          depth: stop.depth,
          time: 180, // 3 minutes maximum
          gas: 'Aire',
          description: `Travel/Shift/Vent - Cambio a O₂ (máx 3 min)`,
          isTimer: true
        });

        // Calculate O₂ segments with breaks
        const { segments } = this.calculateO2Segments(stop.time);
        segments.forEach(segment => {
          timeline.push({
            type: segment.type,
            depth: stop.depth,
            time: segment.time * 60, // Convert to seconds
            gas: segment.gas,
            description: segment.description
          });
        });
        totalTime += stop.time * 60; // Only count O₂ time, not breaks
      } else {
        // Regular air stop
        const stopTimeSeconds = stop.time * 60;
        timeline.push({
          type: 'stop',
          depth: stop.depth,
          time: stopTimeSeconds,
          gas: gas,
          description: `Parada de descompresión en ${stop.depth}m con ${gas}`
        });
        totalTime += stopTimeSeconds;
      }

      currentDepth = stop.depth;
    });

    // Final ascent to surface at 9 m/min
    if (currentDepth > 0) {
      const finalAscentTime = (currentDepth / 9) * 60;
      timeline.push({
        type: 'ascent',
        fromDepth: currentDepth,
        toDepth: 0,
        time: finalAscentTime,
        speed: 9,
        gas: 'Aire',
        description: `Ascenso final a superficie (9 m/min)`
      });
      totalTime += finalAscentTime;
    }

    return { timeline, totalTime };
  }

  /**
   * Parse chamber periods from tabla_1.json
   */
  parseChamberPeriods(periodsString) {
    if (!periodsString || periodsString === 'null') return 0;
    
    // Handle formats like "2", "2.5", "2 periods", "2.5 periods"
    const match = periodsString.toString().match(/([0-9.]+)/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Generate timeline for Surface Decompression on O₂ (SurDO₂)
   */
  generateSurDO2Timeline(entry, realDepth, surfaceInterval = 3.5) {
    const timeline = [];
    let totalTime = 0;
    
    const stops = this.extractStops(entry);
    let currentDepth = realDepth;

    // Phase 1: In-water decompression (complete all stops at 12m and deeper)
    const deepStops = stops.filter(stop => stop.depth >= 12);
    
    deepStops.forEach(stop => {
      // Ascent to stop at 9 m/min
      const ascentDistance = currentDepth - stop.depth;
      if (ascentDistance > 0) {
        const ascentTime = (ascentDistance / 9) * 60;
        timeline.push({
          type: 'ascent',
          fromDepth: currentDepth,
          toDepth: stop.depth,
          time: ascentTime,
          speed: 9,
          gas: 'Aire',
          description: `Ascenso de ${currentDepth}m a ${stop.depth}m (9 m/min)`
        });
        totalTime += ascentTime;
      }

      // Decompression stop
      const stopTimeSeconds = stop.time * 60;
      timeline.push({
        type: 'stop',
        depth: stop.depth,
        time: stopTimeSeconds,
        gas: 'Aire',
        description: `Parada de descompresión en ${stop.depth}m`
      });
      totalTime += stopTimeSeconds;
      currentDepth = stop.depth;
    });

    // Ascent from 12m to surface
    let ascentSpeed = 40; // 40 fsw/min = ~12.2 m/min (using 12 m/min)
    if (currentDepth > 12) {
      // First ascent to 12m at 9 m/min
      const ascentTo12Time = ((currentDepth - 12) / 9) * 60;
      timeline.push({
        type: 'ascent',
        fromDepth: currentDepth,
        toDepth: 12,
        time: ascentTo12Time,
        speed: 9,
        gas: 'Aire',
        description: `Ascenso de ${currentDepth}m a 12m (9 m/min)`
      });
      totalTime += ascentTo12Time;
      currentDepth = 12;
    }

    // Ascent from 12m to surface at 12 m/min
    const surfaceAscentTime = (currentDepth / 12) * 60;
    timeline.push({
      type: 'ascent',
      fromDepth: currentDepth,
      toDepth: 0,
      time: surfaceAscentTime,
      speed: 12,
      gas: 'Aire',
      description: `Ascenso de 12m a superficie (12 m/min)`
    });
    totalTime += surfaceAscentTime;

    // Surface Interval (must be ≤5 min, normal ~3.5 min)
    const surfaceIntervalSeconds = surfaceInterval * 60;
    timeline.push({
      type: 'surface_interval',
      depth: 0,
      time: surfaceIntervalSeconds,
      gas: 'Aire',
      description: `Intervalo en superficie - ${surfaceInterval} min`,
      isTimer: true,
      warningTime: 5 * 60, // 5 minutes
      errorTime: 7 * 60   // 7 minutes
    });
    totalTime += surfaceIntervalSeconds;

    // Phase 2: Chamber compression to 15m (50 fsw) on air
    const compressionTime = (15 / 30) * 60; // 30 m/min descent rate
    timeline.push({
      type: 'compression',
      fromDepth: 0,
      toDepth: 15,
      time: compressionTime,
      speed: 30,
      gas: 'Aire',
      description: `Compresión en cámara a 15m (30 m/min)`
    });
    totalTime += compressionTime;

    // Phase 3: O₂ periods in chamber
    const chamberPeriods = this.parseChamberPeriods(entry['Periodos en camara']);
    let remainingPeriods = chamberPeriods;
    let chamberDepth = 15; // Start at 15m (50 fsw)
    let periodCount = 0;

    while (remainingPeriods > 0) {
      periodCount++;
      
      if (periodCount === 1) {
        // Period 1: First 15 min at 15m, then ascend to 12m, finish at 12m
        timeline.push({
          type: 'o2_period',
          depth: 15,
          time: 15 * 60,
          gas: 'O₂',
          description: `Período 1 de O₂ - 15 min en 15m`
        });

        // Ascent 15m → 12m during Period 1
        const ascentTime = ((15 - 12) / 30) * 60; // 30 m/min ascent
        timeline.push({
          type: 'ascent',
          fromDepth: 15,
          toDepth: 12,
          time: ascentTime,
          speed: 30,
          gas: 'O₂',
          description: `Ascenso 15m → 12m durante Período 1 (30 m/min)`
        });

        // Remaining 15 min of Period 1 at 12m
        timeline.push({
          type: 'o2_period',
          depth: 12,
          time: 15 * 60,
          gas: 'O₂',
          description: `Período 1 de O₂ - 15 min restantes en 12m`
        });

        chamberDepth = 12;
        remainingPeriods -= 1;

        if (remainingPeriods > 0) {
          // Air break after Period 1
          timeline.push({
            type: 'air_break',
            depth: 12,
            time: 5 * 60,
            gas: 'Aire',
            description: `Descanso con aire - 5 min`
          });
        }
      } else if (periodCount <= 4) {
        // Periods 2-4: Full 30 min at 12m
        const periodTime = Math.min(remainingPeriods, 1) * 30 * 60;
        timeline.push({
          type: 'o2_period',
          depth: 12,
          time: periodTime,
          gas: 'O₂',
          description: `Período ${periodCount} de O₂ - ${Math.min(remainingPeriods, 1) * 30} min en 12m`
        });

        remainingPeriods -= Math.min(remainingPeriods, 1);

        if (remainingPeriods > 0) {
          // Air break
          timeline.push({
            type: 'air_break',
            depth: 12,
            time: 5 * 60,
            gas: 'Aire',
            description: `Descanso con aire - 5 min`
          });

          // Check if we need to ascend to 9m before Period 5
          if (periodCount === 4 && remainingPeriods > 0) {
            // Ascent 12m → 9m during air break
            const ascentTime = ((12 - 9) / 30) * 60;
            timeline.push({
              type: 'ascent',
              fromDepth: 12,
              toDepth: 9,
              time: ascentTime,
              speed: 30,
              gas: 'Aire',
              description: `Ascenso 12m → 9m durante descanso (30 m/min)`
            });
            chamberDepth = 9;
          }
        }
      } else {
        // Periods 5+: At 9m
        const periodTime = Math.min(remainingPeriods, 1) * 30 * 60;
        timeline.push({
          type: 'o2_period',
          depth: 9,
          time: periodTime,
          gas: 'O₂',
          description: `Período ${periodCount} de O₂ - ${Math.min(remainingPeriods, 1) * 30} min en 9m`
        });

        remainingPeriods -= Math.min(remainingPeriods, 1);

        if (remainingPeriods > 0) {
          // Air break
          timeline.push({
            type: 'air_break',
            depth: 9,
            time: 5 * 60,
            gas: 'Aire',
            description: `Descanso con aire - 5 min`
          });
        }
      }
    }

    // Final ascent to surface on air at 30 m/min
    const finalAscentTime = (chamberDepth / 30) * 60;
    timeline.push({
      type: 'ascent',
      fromDepth: chamberDepth,
      toDepth: 0,
      time: finalAscentTime,
      speed: 30,
      gas: 'Aire',
      description: `Ascenso final a superficie en cámara (30 m/min)`
    });
    totalTime += finalAscentTime;

    return { timeline, totalTime };
  }

  /**
   * Get repetitive group for altitude (if diver <12h at altitude)
   */
  getAltitudeRepetitiveGroup(altitudeMeters) {
    // Find matching altitude entry in tabla_3.json
    const altitudeEntry = this.tabla3.find(entry => entry['Altitud (m)'] >= altitudeMeters);
    return altitudeEntry ? altitudeEntry['Grupo Repetitivo'] : 'A';
  }

  /**
   * Format time in mm:ss format
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Main calculation function - Calculate complete dive plan
   */
  calculateDivePlan(params) {
    const {
      mode,
      depth,
      bottomTime,
      altitude = 0,
      recalibrated = false,
      isRepetitive = false,
      repetitiveGroup = '',
      surfaceInterval = '',
      surfaceIntervalSurDO2 = 3.5
    } = params;

    try {
      // Step 1: Calculate equivalent depth for altitude
      const { realDepth, equivalentDepth } = this.calculateEquivalentDepth(
        depth, 
        altitude, 
        recalibrated
      );

      // Step 2: Handle repetitive dives if applicable
      let adjustedBottomTime = bottomTime;
      if (isRepetitive && repetitiveGroup && surfaceInterval) {
        // TODO: Implement repetitive dive calculations using tabla_2_1 and tabla_2_2
        // For now, use the original bottom time
      }

      // Step 3: Find matching entry in tabla_1
      const tableResult = this.findTable1Entry(mode, equivalentDepth, adjustedBottomTime);
      
      if (!tableResult.success) {
        return {
          success: false,
          error: 'No existe programa para el modo seleccionado en esta combinación de profundidad/tiempo.',
          alternatives: tableResult.alternativeModes
        };
      }

      const entry = tableResult.entry;

      // Step 4: Check if it's a no-decompression dive
      if (this.isNoDecompressionDive(entry)) {
        const ascentTime = (realDepth / 9) * 60; // 9 m/min
        return {
          success: true,
          noDecompression: true,
          realDepth,
          equivalentDepth,
          entry,
          timeline: [{
            type: 'ascent',
            fromDepth: realDepth,
            toDepth: 0,
            time: ascentTime,
            speed: 9,
            gas: 'Aire',
            description: 'Ascenso directo a superficie a 9 m/min'
          }],
          totalTime: ascentTime,
          repetitiveGroup: entry['Grupo Repetición']
        };
      }

      // Step 5: Generate timeline based on mode
      let result;
      switch (mode) {
        case 'aire':
          result = this.generateAirDecompressionTimeline(entry, realDepth);
          break;
        case 'o2_agua':
          result = this.generateO2WaterDecompressionTimeline(entry, realDepth);
          break;
        case 'surdo2':
          result = this.generateSurDO2Timeline(entry, realDepth, surfaceIntervalSurDO2);
          break;
        default:
          throw new Error('Modo no válido');
      }

      return {
        success: true,
        noDecompression: false,
        realDepth,
        equivalentDepth,
        entry,
        timeline: result.timeline,
        totalTime: result.totalTime,
        repetitiveGroup: entry['Grupo Repetición'],
        tableDepth: entry['Profundidad (m)'],
        tableTime: entry['Tiempo de Fondo (min)']
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new USNavyCalculatorService();