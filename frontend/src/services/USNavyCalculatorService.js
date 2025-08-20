import tabla1 from '../../tables/tabla_1.json';
import tabla2_1 from '../../tables/tabla_2_1.json';
import tabla2_2 from '../../tables/tabla_2_2.json';
import tabla3 from '../../tables/tabla_3.json';
import tabla4 from '../../tables/tabla_4.json';

class USNavyCalculatorService {
  constructor() {
    this.tabla1 = tabla1;
    this.tabla2_1 = tabla2_1;
    this.tabla2_2 = tabla2_2;
    this.tabla3 = tabla3;
    this.tabla4 = tabla4;
  }

  /**
   * Calculate barometric pressure at altitude
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
    
    // If not recalibrated, add depth correction
    if (!recalibrated) {
      const depthCorrection = (altitudeMeters / 304.32) * 0.3; // +0.3m per 304.32m altitude
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
   */
  findTable1Entry(mode, depth, bottomTime) {
    const modeFieldMap = {
      'aire': 'Descompresion con aire',
      'o2_agua': 'Descompresion con O2 en el agua ',
      'surdo2': 'Descompresion en superficie'
    };

    const modeField = modeFieldMap[mode];
    
    // Find entries where the mode flag is "Sí"
    const validEntries = this.tabla1.filter(entry => entry[modeField] === 'Sí');
    
    if (validEntries.length === 0) {
      return null;
    }

    // Find exact or next greater depth
    const depthEntries = validEntries.filter(entry => 
      entry['Profundidad (m)'] >= depth
    );
    
    if (depthEntries.length === 0) {
      return null;
    }

    // Sort by depth and get entries for the smallest applicable depth
    depthEntries.sort((a, b) => a['Profundidad (m)'] - b['Profundidad (m)']);
    const targetDepth = depthEntries[0]['Profundidad (m)'];
    const depthMatchEntries = depthEntries.filter(entry => 
      entry['Profundidad (m)'] === targetDepth
    );

    // Find exact or next greater time
    const timeEntries = depthMatchEntries.filter(entry => 
      entry['Tiempo de Fondo (min)'] >= bottomTime
    );
    
    if (timeEntries.length === 0) {
      return null;
    }

    // Sort by time and get the smallest applicable time
    timeEntries.sort((a, b) => a['Tiempo de Fondo (min)'] - b['Tiempo de Fondo (min)']);
    
    return timeEntries[0];
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
   * Generate timeline for air decompression
   */
  generateAirDecompressionTimeline(entry, realDepth) {
    const timeline = [];
    let currentDepth = realDepth;
    let totalTime = 0;
    
    // Extract stop depths and times
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

    // Calculate ascent segments and add stops
    stops.forEach((stop, index) => {
      // Ascent to stop
      const ascentDistance = currentDepth - stop.depth;
      if (ascentDistance > 0) {
        const ascentTime = (ascentDistance / 9) * 60; // 9 m/min = seconds
        timeline.push({
          type: 'ascent',
          fromDepth: currentDepth,
          toDepth: stop.depth,
          time: ascentTime,
          gas: 'Aire',
          description: `Ascenso de ${currentDepth}m a ${stop.depth}m`
        });
        totalTime += ascentTime;
      }

      // Stop
      const stopTimeSeconds = stop.time * 60;
      timeline.push({
        type: 'stop',
        depth: stop.depth,
        time: stopTimeSeconds,
        gas: 'Aire',
        description: `Parada en ${stop.depth}m`
      });
      totalTime += stopTimeSeconds;
      currentDepth = stop.depth;
    });

    // Final ascent to surface
    if (currentDepth > 0) {
      const finalAscentTime = (currentDepth / 9) * 60;
      timeline.push({
        type: 'ascent',
        fromDepth: currentDepth,
        toDepth: 0,
        time: finalAscentTime,
        gas: 'Aire',
        description: `Ascenso final a superficie`
      });
      totalTime += finalAscentTime;
    }

    return { timeline, totalTime };
  }

  /**
   * Generate timeline for O2 in water decompression
   */
  generateO2WaterDecompressionTimeline(entry, realDepth) {
    const timeline = [];
    let currentDepth = realDepth;
    let totalTime = 0;
    
    // Extract all stops
    const stops = [];
    const stopFields = [
      'Parada 39.6m', 'Parada 36.6m', 'Parada 33.5m', 'Parada 30.5m',
      'Parada 27.4m', 'Parada 24.4m', 'Parada 21.3m', 'Parada 18.3m',
      'Parada 15.2m', 'Parada 12.2m', 'Parada 9.1m', 'Parada 6.1m'
    ];

    stopFields.forEach(field => {
      if (entry[field] && entry[field] > 0) {
        const depth = parseFloat(field.replace('Parada ', '').replace('m', ''));
        const gas = (depth <= 9) ? 'O₂' : 'Aire'; // O2 at 9m (30fsw) and 6m (20fsw)
        stops.push({ depth, time: entry[field], gas });
      }
    });

    stops.sort((a, b) => b.depth - a.depth);

    stops.forEach((stop, index) => {
      // Ascent to stop
      const ascentDistance = currentDepth - stop.depth;
      if (ascentDistance > 0) {
        const ascentTime = (ascentDistance / 9) * 60;
        timeline.push({
          type: 'ascent',
          fromDepth: currentDepth,
          toDepth: stop.depth,
          time: ascentTime,
          gas: 'Aire',
          description: `Ascenso de ${currentDepth}m a ${stop.depth}m`
        });
        totalTime += ascentTime;
      }

      // Handle O2 stops with breaks
      if (stop.gas === 'O₂') {
        const { segments, totalStopTime } = this.calculateO2Segments(stop.time);
        segments.forEach(segment => {
          timeline.push({
            type: segment.type,
            depth: stop.depth,
            time: segment.time * 60,
            gas: segment.gas,
            description: segment.description
          });
        });
        totalTime += totalStopTime * 60;
      } else {
        // Regular air stop
        const stopTimeSeconds = stop.time * 60;
        timeline.push({
          type: 'stop',
          depth: stop.depth,
          time: stopTimeSeconds,
          gas: stop.gas,
          description: `Parada en ${stop.depth}m con ${stop.gas}`
        });
        totalTime += stopTimeSeconds;
      }

      currentDepth = stop.depth;
    });

    // Final ascent to surface
    if (currentDepth > 0) {
      const finalAscentTime = (currentDepth / 9) * 60;
      timeline.push({
        type: 'ascent',
        fromDepth: currentDepth,
        toDepth: 0,
        time: finalAscentTime,
        gas: 'Aire',
        description: `Ascenso final a superficie`
      });
      totalTime += finalAscentTime;
    }

    return { timeline, totalTime };
  }

  /**
   * Calculate O2 segments with breaks (30 min O2, 5 min air break)
   */
  calculateO2Segments(totalO2Time) {
    const segments = [];
    let remainingTime = totalO2Time;
    let segmentCount = 0;

    while (remainingTime > 0) {
      segmentCount++;
      
      if (remainingTime <= 35) {
        // Final segment, no break needed
        segments.push({
          type: 'stop',
          time: remainingTime,
          gas: 'O₂',
          description: `Período ${segmentCount} de O₂ - ${remainingTime} min`
        });
        remainingTime = 0;
      } else {
        // 30-minute O2 period
        segments.push({
          type: 'stop',
          time: 30,
          gas: 'O₂',
          description: `Período ${segmentCount} de O₂ - 30 min`
        });
        
        // 5-minute air break
        segments.push({
          type: 'break',
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
   * Format time in mm:ss format
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate dive plan
   */
  calculateDivePlan(params) {
    const {
      mode,
      depth,
      bottomTime,
      altitude = 0,
      recalibrated = false
    } = params;

    try {
      // Calculate equivalent depth for altitude
      const { realDepth, equivalentDepth } = this.calculateEquivalentDepth(
        depth, 
        altitude, 
        recalibrated
      );

      // Find matching entry in tabla_1
      const entry = this.findTable1Entry(mode, equivalentDepth, bottomTime);
      
      if (!entry) {
        // Check if other modes are available
        const alternatives = ['aire', 'o2_agua', 'surdo2'].filter(m => {
          if (m === mode) return false;
          return this.findTable1Entry(m, equivalentDepth, bottomTime) !== null;
        });

        return {
          success: false,
          error: 'No existe programa para el modo seleccionado en esta combinación de profundidad/tiempo.',
          alternatives: alternatives.length > 0 ? alternatives : null
        };
      }

      // Check if it's a no-decompression dive
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
            gas: 'Aire',
            description: 'Ascenso directo a superficie a 9 m/min'
          }],
          totalTime: ascentTime
        };
      }

      // Generate timeline based on mode
      let result;
      switch (mode) {
        case 'aire':
          result = this.generateAirDecompressionTimeline(entry, realDepth);
          break;
        case 'o2_agua':
          result = this.generateO2WaterDecompressionTimeline(entry, realDepth);
          break;
        case 'surdo2':
          // TODO: Implement SurDO2 logic
          result = this.generateAirDecompressionTimeline(entry, realDepth);
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
        totalTime: result.totalTime
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