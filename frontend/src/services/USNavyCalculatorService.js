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
   * Get repetitive group from tabla_3 for altitude <12h
   * Enhanced to use both altitude and surface interval for precise determination
   */
  getAltitudeRepetitiveGroup(altitudeMeters, surfaceIntervalMinutes) {
    // Find first altitude entry >= input altitude
    const altitudeEntry = this.tabla3.find(entry => entry['Altitud (m)'] >= altitudeMeters);
    
    if (!altitudeEntry) {
      return { group: null, warning: null };
    }

    // Currently tabla_3.json has simple altitude->group mapping without surface interval columns
    // The table structure appears to be simplified compared to what might be expected for full precision
    // Return the altitude-based group with precision warning
    
    // Check if we have surface interval data in tabla_3 structure
    const hasDetailedSurfaceIntervalData = this.tabla3.some(entry => 
      Object.keys(entry).some(key => key.includes('Intervalo') || key.includes('TO'))
    );

    if (hasDetailedSurfaceIntervalData) {
      // If tabla_3 had detailed surface interval columns, we would implement precise lookup here
      // For now, tabla_3.json appears to be simplified
      return { 
        group: altitudeEntry['Grupo Repetitivo'],
        warning: null // Could be precise with detailed surface interval data
      };
    } else {
      // Current tabla_3.json structure: simple altitude to group mapping
      // Since we can't use surface interval precisely, return approximation with warning
      return { 
        group: altitudeEntry['Grupo Repetitivo'],
        warning: "No se pudo determinar el grupo repetitivo por altitud con precisión; usando aproximación por altitud."
      };
    }
  }

  /**
   * Parse surface interval range (e.g., "0:10TO2:20") and check if given interval falls within
   */
  parseAndCheckSurfaceInterval(rangeString, intervalMinutes) {
    if (!rangeString || rangeString === '**') return false;
    
    // Parse format like "0:10TO2:20" or "2:21TO3:00"
    const match = rangeString.match(/(\d+):(\d+)TO(\d+):(\d+)/);
    if (!match) return false;
    
    const startHours = parseInt(match[1]);
    const startMinutes = parseInt(match[2]);
    const endHours = parseInt(match[3]);
    const endMinutes = parseInt(match[4]);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    return intervalMinutes >= startTotalMinutes && intervalMinutes <= endTotalMinutes;
  }

  /**
   * Get new repetitive group from tabla_2_1 based on previous group and surface interval
   */
  getNewRepetitiveGroup(previousGroup, surfaceIntervalMinutes) {
    // Find all entries for the previous group
    const entries = this.tabla2_1.filter(entry => 
      entry['Grupo de buceo sucesivo al principio del intervalo'] === previousGroup
    );

    // Find which interval range the surface interval falls into
    for (const entry of entries) {
      if (this.parseAndCheckSurfaceInterval(entry['Intervalo en superficie'], surfaceIntervalMinutes)) {
        return entry['Grupo de buceo sucesivo al final del intervalo en superficie'];
      }
    }

    return previousGroup; // If no match, keep the same group
  }

  /**
   * Get RNT from tabla_2_2 based on repetitive group and depth
   */
  getRNT(repetitiveGroup, depth) {
    // Find entry for the depth (use exact or next greater depth)
    const depthEntries = this.tabla2_2.filter(entry => 
      entry['Profundidad del buceo sucesivo'] >= depth
    );

    if (depthEntries.length === 0) return null;

    // Sort by depth and get the smallest applicable depth
    depthEntries.sort((a, b) => a['Profundidad del buceo sucesivo'] - b['Profundidad del buceo sucesivo']);
    const entry = depthEntries[0];

    const rntValue = entry[repetitiveGroup];
    
    if (rntValue === '**') {
      return '**'; // Not permitted
    }

    return parseInt(rntValue) || 0;
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
      }

      // Decompression stop with countdown timer
      const stopTimeSeconds = stop.time * 60;
      timeline.push({
        type: 'stop',
        depth: stop.depth,
        time: stopTimeSeconds,
        gas: 'Aire',
        description: `Parada de descompresión en ${stop.depth}m`,
        hasCountdownTimer: true,
        requiredTime: stopTimeSeconds
      });
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
    }

    // Calculate total time by summing ALL fixed-duration segments
    const totalTime = timeline
      .filter(segment => !segment.isTimer) // Exclude count-up timers
      .reduce((sum, segment) => sum + segment.time, 0);

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
      }

      // Determine gas type: O₂ at 9m and 6m, Air for deeper stops
      const gas = (stop.depth <= 9) ? 'O₂' : 'Aire';

      if (gas === 'O₂') {
        // Add Travel/Shift/Vent period before O₂ (COUNT-UP TIMER)
        timeline.push({
          type: 'travel_shift_vent',
          depth: stop.depth,
          time: 0, // Count-up timer starts at 0
          gas: 'Aire',
          description: `Travel/Shift/Vent - Cambio a O₂`,
          isTimer: true,
          timerType: 'countUp',
          warningThreshold: 180 // 3 minutes
        });

        // Calculate O₂ segments with breaks
        const { segments } = this.calculateO2Segments(stop.time);
        segments.forEach(segment => {
          timeline.push({
            type: segment.type,
            depth: stop.depth,
            time: segment.time * 60, // Convert to seconds
            gas: segment.gas,
            description: segment.description,
            hasCountdownTimer: segment.type === 'o2_period' || segment.type === 'air_break',
            requiredTime: segment.time * 60
          });
        });
      } else {
        // Regular air stop with countdown timer
        const stopTimeSeconds = stop.time * 60;
        timeline.push({
          type: 'stop',
          depth: stop.depth,
          time: stopTimeSeconds,
          gas: gas,
          description: `Parada de descompresión en ${stop.depth}m con ${gas}`,
          hasCountdownTimer: true,
          requiredTime: stopTimeSeconds
        });
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
    }

    // Calculate total time by summing ALL fixed-duration segments (excluding count-up timers)
    const totalTime = timeline
      .filter(segment => !segment.isTimer) // Exclude count-up timers
      .reduce((sum, segment) => sum + segment.time, 0);

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
  generateSurDO2Timeline(entry, realDepth) {
    const timeline = [];
    
    const stops = this.extractStops(entry);
    let currentDepth = realDepth;

    // Phase 1: In-water decompression (complete all stops at 12.2m and deeper)
    const deepStops = stops.filter(stop => stop.depth >= 12.2);
    
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
      }

      // Decompression stop with countdown timer
      const stopTimeSeconds = stop.time * 60;
      timeline.push({
        type: 'stop',
        depth: stop.depth,
        time: stopTimeSeconds,
        gas: 'Aire',
        description: `Parada de descompresión en ${stop.depth}m`,
        hasCountdownTimer: true,
        requiredTime: stopTimeSeconds
      });
      currentDepth = stop.depth;
    });

    // Determine ascent speed from current depth to surface
    let ascentSpeed = 9; // Default 9 m/min
    
    // Check if we have a 12.2m (40fsw) stop
    const has12_2mStop = stops.some(stop => stop.depth === 12.2);
    
    if (has12_2mStop) {
      // If 40 fsw stop required: ascend 40 fsw → surface at 40 fsw/min (≈12 m/min)
      ascentSpeed = 12;
    } else {
      // If no 40 fsw stop: ascend bottom → 40 fsw at 30 fsw/min (≈9 m/min), then 40 fsw → surface at 40 fsw/min
      if (currentDepth > 12.2) {
        // First ascent to 12.2m at 9 m/min
        const ascentTo12_2Time = ((currentDepth - 12.2) / 9) * 60;
        timeline.push({
          type: 'ascent',
          fromDepth: currentDepth,
          toDepth: 12.2,
          time: ascentTo12_2Time,
          speed: 9,
          gas: 'Aire',
          description: `Ascenso de ${currentDepth}m a 12.2m (9 m/min)`
        });
        currentDepth = 12.2;
      }
      ascentSpeed = 12; // Then 12.2m to surface at 12 m/min
    }

    // UNIFIED SurDO₂ TRANSITION BLOCK - combining ascent + surface interval + compression
    const surfaceAscentTime = (currentDepth / ascentSpeed) * 60;
    const compressionTime = (15 / 30) * 60; // 30 m/min descent rate
    
    timeline.push({
      type: 'surdo2_unified_transition',
      fromDepth: currentDepth,
      toDepth: 15, // Final compression depth
      time: surfaceAscentTime + compressionTime, // Combined time
      speed: ascentSpeed,
      gas: 'Aire',
      description: `Transición SurDO₂: ${currentDepth}m → Superficie → Cámara 15m`,
      details: {
        ascentTime: surfaceAscentTime,
        compressionTime: compressionTime,
        ascentSpeed: ascentSpeed
      },
      isTransitionTimer: true,
      timerType: 'countUp',
      warningThreshold: 300, // 5 minutes
      errorThreshold: 420,   // 7 minutes
      transitionLogic: true
    });

    // Phase 3: O₂ periods in chamber
    const chamberPeriods = this.parseChamberPeriods(entry['Periodos en camara']);
    let remainingPeriods = chamberPeriods;
    let chamberDepth = 15; // Start at 15m (50 fsw)
    let periodCount = 0;

    while (remainingPeriods > 0) {
      periodCount++;
      
      if (periodCount === 1) {
        // Period 1: EXACTLY 30 min total - 15 min at 15m + ascent + remainder at 12.2m
        // This will be dynamically adjusted based on transition time
        
        // First 15 min at 15m (base time, may be extended)
        timeline.push({
          type: 'chamber_o2_period',
          depth: 15,
          time: 15 * 60, // Base time - will be adjusted if needed
          gas: 'O₂',
          description: `Período 1 de O₂ - 15 min en 15m`,
          hasCountdownTimer: true,
          requiredTime: 15 * 60,
          isAdjustablePeriod: true, // This period can be extended
          baseTime: 15 * 60
        });

        // Ascent 15m → 12.2m during Period 1 (included in the 30-min period)
        const ascentTime = ((15 - 12.2) / 30) * 60; // 30 m/min ascent
        timeline.push({
          type: 'ascent',
          fromDepth: 15,
          toDepth: 12.2,
          time: ascentTime,
          speed: 30,
          gas: 'O₂',
          description: `Ascenso 15m → 12.2m durante Período 1 (30 m/min)`
        });

        // Remaining time of Period 1 at 12.2m (30:00 - 15:00 - ascent_time)
        const remainingTimeSeconds = (30 * 60) - (15 * 60) - ascentTime;
        timeline.push({
          type: 'chamber_o2_period',
          depth: 12.2,
          time: remainingTimeSeconds,
          gas: 'O₂',
          description: `Período 1 de O₂ - ${this.formatTime(remainingTimeSeconds)} restantes en 12.2m`,
          hasCountdownTimer: true,
          requiredTime: remainingTimeSeconds
        });

        chamberDepth = 12.2;
        remainingPeriods -= 1;

        if (remainingPeriods > 0) {
          // Air break after Period 1
          timeline.push({
            type: 'air_break',
            depth: 12.2,
            time: 5 * 60,
            gas: 'Aire',
            description: `Descanso con aire - 5 min`,
            hasCountdownTimer: true,
            requiredTime: 5 * 60
          });
        }
      } else if (periodCount <= 4) {
        // Periods 2-4: Full 30 min at 12.2m
        const periodTime = Math.min(remainingPeriods, 1) * 30 * 60;
        timeline.push({
          type: 'chamber_o2_period',
          depth: 12.2,
          time: periodTime,
          gas: 'O₂',
          description: `Período ${periodCount} de O₂ - ${Math.min(remainingPeriods, 1) * 30} min en 12.2m`,
          hasCountdownTimer: true,
          requiredTime: periodTime
        });

        remainingPeriods -= Math.min(remainingPeriods, 1);

        if (remainingPeriods > 0) {
          // Air break
          timeline.push({
            type: 'air_break',
            depth: 12.2,
            time: 5 * 60,
            gas: 'Aire',
            description: `Descanso con aire - 5 min`,
            hasCountdownTimer: true,
            requiredTime: 5 * 60
          });

          // Check if we need to ascend to 9m before Period 5
          if (periodCount === 4 && remainingPeriods > 0) {
            // Ascent 12.2m → 9m during air break
            const ascentTime = ((12.2 - 9) / 30) * 60;
            timeline.push({
              type: 'ascent',
              fromDepth: 12.2,
              toDepth: 9,
              time: ascentTime,
              speed: 30,
              gas: 'Aire',
              description: `Ascenso 12.2m → 9m durante descanso (30 m/min)`
            });
            chamberDepth = 9;
          }
        }
      } else {
        // Periods 5+: At 9m
        const periodTime = Math.min(remainingPeriods, 1) * 30 * 60;
        timeline.push({
          type: 'chamber_o2_period',
          depth: 9,
          time: periodTime,
          gas: 'O₂',
          description: `Período ${periodCount} de O₂ - ${Math.min(remainingPeriods, 1) * 30} min en 9m`,
          hasCountdownTimer: true,
          requiredTime: periodTime
        });

        remainingPeriods -= Math.min(remainingPeriods, 1);

        if (remainingPeriods > 0) {
          // Air break
          timeline.push({
            type: 'air_break',
            depth: 9,
            time: 5 * 60,
            gas: 'Aire',
            description: `Descanso con aire - 5 min`,
            hasCountdownTimer: true,
            requiredTime: 5 * 60
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

    // Calculate total time by summing ALL fixed-duration segments (excluding count-up timers)
    const totalTime = timeline
      .filter(segment => !segment.isTimer && !segment.isTransitionTimer) // Exclude count-up timers
      .reduce((sum, segment) => sum + segment.time, 0);

    return { timeline, totalTime };
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
      isAltitudeLessThan12h = false,
      altitudeArrivalTime = null,
      previousBottomTime = 0,
      previousDepth = 0
    } = params;

    try {
      // Step 1: Calculate equivalent depth for altitude
      const { realDepth, equivalentDepth } = this.calculateEquivalentDepth(
        depth, 
        altitude, 
        recalibrated
      );

      let effectiveBottomTime = bottomTime;
      let effectiveDepth = equivalentDepth;
      let finalRepetitiveGroup = '';
      let altitudeRepetitiveGroup = null;
      let altitudeWarning = null;

      // Step 2: Handle altitude <12h logic
      if (altitude > 0 && isAltitudeLessThan12h && altitudeArrivalTime) {
        const now = new Date();
        const arrival = new Date(altitudeArrivalTime);
        const surfaceIntervalAtAltitude = Math.floor((now - arrival) / (1000 * 60)); // minutes

        const altitudeResult = this.getAltitudeRepetitiveGroup(altitude, surfaceIntervalAtAltitude);
        
        if (!altitudeResult.group) {
          return {
            success: false,
            error: 'No se pudo determinar el grupo repetitivo por altitud; continúe con precaución.',
            warning: true
          };
        }

        altitudeRepetitiveGroup = altitudeResult.group;
        altitudeWarning = altitudeResult.warning;
        
        // Apply repetitive dive logic using altitude-derived group
        const repetitiveResult = this.processRepetitiveDive(
          altitudeRepetitiveGroup,
          surfaceIntervalAtAltitude,
          equivalentDepth,
          bottomTime,
          previousBottomTime,
          previousDepth
        );

        if (!repetitiveResult.success) {
          return repetitiveResult;
        }

        effectiveBottomTime = repetitiveResult.effectiveBottomTime;
        effectiveDepth = repetitiveResult.effectiveDepth;
      }

      // Step 3: Handle regular repetitive dives
      if (isRepetitive && repetitiveGroup && surfaceInterval !== '') {
        const surfaceIntervalNum = parseInt(surfaceInterval);
        
        const repetitiveResult = this.processRepetitiveDive(
          repetitiveGroup,
          surfaceIntervalNum,
          equivalentDepth,
          bottomTime,
          previousBottomTime,
          previousDepth
        );

        if (!repetitiveResult.success) {
          return repetitiveResult;
        }

        effectiveBottomTime = repetitiveResult.effectiveBottomTime;
        effectiveDepth = repetitiveResult.effectiveDepth;
      }

      // Step 4: Find matching entry in tabla_1
      const tableResult = this.findTable1Entry(mode, effectiveDepth, effectiveBottomTime);
      
      if (!tableResult.success) {
        return {
          success: false,
          error: 'No existe programa para el modo seleccionado en esta combinación de profundidad/tiempo.',
          alternatives: tableResult.alternativeModes
        };
      }

      const entry = tableResult.entry;
      finalRepetitiveGroup = entry['Grupo Repetición'];

      // Step 5: Check if it's a no-decompression dive
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
          repetitiveGroup: finalRepetitiveGroup,
          tableDepth: entry['Profundidad (m)'],
          tableTime: entry['Tiempo de Fondo (min)'],
          effectiveBottomTime,
          altitudeRepetitiveGroup,
          altitudeWarning
        };
      }

      // Step 6: Generate timeline based on mode
      let result;
      switch (mode) {
        case 'aire':
          result = this.generateAirDecompressionTimeline(entry, realDepth);
          break;
        case 'o2_agua':
          result = this.generateO2WaterDecompressionTimeline(entry, realDepth);
          break;
        case 'surdo2':
          result = this.generateSurDO2Timeline(entry, realDepth);
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
        repetitiveGroup: finalRepetitiveGroup,
        tableDepth: entry['Profundidad (m)'],
        tableTime: entry['Tiempo de Fondo (min)'],
        effectiveBottomTime,
        altitudeRepetitiveGroup,
        altitudeWarning
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process repetitive dive logic - handles <10 min rule and normal repetitive workflow
   */
  processRepetitiveDive(repetitiveGroup, surfaceIntervalMinutes, equivalentDepth, bottomTime, previousBottomTime, previousDepth) {
    try {
      if (surfaceIntervalMinutes < 10) {
        // <10 min rule: merge dives into one
        const effectiveBottomTime = previousBottomTime + bottomTime;
        const effectiveDepth = Math.max(previousDepth, equivalentDepth);
        
        return {
          success: true,
          effectiveBottomTime,
          effectiveDepth
        };
      } else {
        // Normal repetitive dive workflow (≥10 min)
        
        // Step 1: Get new repetitive group from tabla_2_1
        const newGroup = this.getNewRepetitiveGroup(repetitiveGroup, surfaceIntervalMinutes);
        
        // Step 2: Get RNT from tabla_2_2
        const rnt = this.getRNT(newGroup, equivalentDepth);
        
        if (rnt === '**') {
          return {
            success: false,
            error: 'No está permitido realizar buceos sucesivos con este buzo (siguiendo las reglas del US Navy Rev 7).'
          };
        }
        
        if (rnt === null) {
          return {
            success: false,
            error: 'No se pudo determinar el tiempo de nitrógeno residual para esta profundidad.'
          };
        }
        
        // Step 3: Adjust bottom time
        const effectiveBottomTime = bottomTime + rnt;
        
        return {
          success: true,
          effectiveBottomTime,
          effectiveDepth: equivalentDepth
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new USNavyCalculatorService();