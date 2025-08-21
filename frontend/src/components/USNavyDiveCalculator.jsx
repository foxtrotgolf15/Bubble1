import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { AlertTriangle, Calculator, ArrowLeft, ArrowRight, Loader2, Clock, Gauge, Timer, AlertCircle, Play, Pause, RotateCcw } from 'lucide-react';
import USNavyCalculatorService from '../services/USNavyCalculatorService';

const USNavyDiveCalculator = () => {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSurDO2Popup, setShowSurDO2Popup] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const [formData, setFormData] = useState({
    mode: '',
    depth: '',
    bottomTime: '',
    altitude: 0,
    recalibrated: false,
    isRepetitive: false,
    repetitiveGroup: '',
    surfaceInterval: '',
    moreThan12hAtAltitude: true,
    altitudeArrivalTime: '',
    previousBottomTime: '',
    previousDepth: ''
  });
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState({});
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('info');

  const modeOptions = [
    { value: 'aire', label: 'Descompresión con aire' },
    { value: 'o2_agua', label: 'Descompresión con O₂ en el agua' },
    { value: 'surdo2', label: 'Descompresión en cámara (SurDO₂)' }
  ];

  const validateScreen1 = () => {
    const newErrors = {};
    
    if (!formData.mode) {
      newErrors.mode = 'Seleccione un modo de descompresión';
    }
    
    if (!formData.depth || formData.depth <= 0) {
      newErrors.depth = 'La profundidad debe ser mayor a 0';
    }
    
    if (!formData.bottomTime || formData.bottomTime <= 0) {
      newErrors.bottomTime = 'El tiempo de fondo debe ser mayor a 0';
    }
    
    if (formData.altitude < 0) {
      newErrors.altitude = 'La altitud no puede ser negativa';
    }

    // Validate altitude <12h fields
    if (formData.altitude > 0 && !formData.moreThan12hAtAltitude && !formData.altitudeArrivalTime) {
      newErrors.altitudeArrivalTime = 'Ingrese la hora de llegada a la altitud';
    }

    // Validate repetitive dive fields
    if (formData.isRepetitive) {
      if (!formData.repetitiveGroup) {
        newErrors.repetitiveGroup = 'Seleccione el grupo repetitivo anterior';
      }
      if (!formData.surfaceInterval) {
        newErrors.surfaceInterval = 'Ingrese el intervalo en superficie';
      }
      if (formData.surfaceInterval && parseInt(formData.surfaceInterval) < 10) {
        if (!formData.previousBottomTime) {
          newErrors.previousBottomTime = 'Para intervalos <10 min, ingrese el tiempo de fondo anterior';
        }
        if (!formData.previousDepth) {
          newErrors.previousDepth = 'Para intervalos <10 min, ingrese la profundidad anterior';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = async () => {
    if (validateScreen1()) {
      setLoading(true);
      setErrors({});
      
      try {
        const params = {
          mode: formData.mode,
          depth: parseFloat(formData.depth),
          bottomTime: parseInt(formData.bottomTime),
          altitude: parseFloat(formData.altitude) || 0,
          recalibrated: formData.recalibrated,
          isRepetitive: formData.isRepetitive,
          repetitiveGroup: formData.repetitiveGroup,
          surfaceInterval: formData.surfaceInterval,
          isAltitudeLessThan12h: formData.altitude > 0 && !formData.moreThan12hAtAltitude,
          altitudeArrivalTime: formData.altitudeArrivalTime,
          previousBottomTime: parseInt(formData.previousBottomTime) || 0,
          previousDepth: parseFloat(formData.previousDepth) || 0
        };

        const result = USNavyCalculatorService.calculateDivePlan(params);
        
        if (result.success) {
          setResults(result);
          setCurrentScreen(2);
        } else {
          setErrors({ 
            calculation: result.error,
            alternatives: result.alternatives,
            isWarning: result.warning 
          });
        }
      } catch (error) {
        console.error('Error calculating dive plan:', error);
        setErrors({ calculation: 'Error en el cálculo. Verifique los datos ingresados.' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (currentScreen > 1) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  const handleStartNew = () => {
    setCurrentScreen(1);
    setFormData({
      mode: '',
      depth: '',
      bottomTime: '',
      altitude: 0,
      recalibrated: false,
      isRepetitive: false,
      repetitiveGroup: '',
      surfaceInterval: '',
      moreThan12hAtAltitude: true,
      altitudeArrivalTime: '',
      previousBottomTime: '',
      previousDepth: ''
    });
    setResults(null);
    setErrors({});
  };

  // Timer Component - handles both countdown timers for stops and count-up timers for transitions
  const TimerComponent = ({ segment, index, onWarning, onError, onPopup, onTransitionAdjustment, embedded = false }) => {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [countdownSeconds, setCountdownSeconds] = useState(segment.requiredTime || 0);
    const [isRunning, setIsRunning] = useState(false);
    const [hasWarned, setHasWarned] = useState(false);
    const [hasErrored, setHasErrored] = useState(false);
    const [hasTriggeredPopup, setHasTriggeredPopup] = useState(false);
    const [hasAdjusted, setHasAdjusted] = useState(false);
    const intervalRef = useRef(null);

    // Determine timer type
    const isCountdownTimer = segment.hasCountdownTimer;
    const isTransitionTimer = segment.isTransitionTimer;
    const isCountUpTimer = segment.isTimer && segment.timerType === 'countUp';

    useEffect(() => {
      if (isRunning) {
        intervalRef.current = setInterval(() => {
          if (isCountdownTimer) {
            // Countdown timer logic
            setCountdownSeconds(prev => {
              const newCountdown = Math.max(0, prev - 1);
              if (newCountdown === 0) {
                // Timer completed - trigger alarm
                setIsRunning(false);
                if (onWarning) onWarning(segment, index, 'Timer completado');
              }
              return newCountdown;
            });
          } else {
            // Count-up timer logic (for transitions and surface intervals)
            setElapsedSeconds(prev => {
              const newElapsed = prev + 1;
              
              if (isTransitionTimer && segment.transitionLogic) {
                // SurDO₂ transition logic
                if (newElapsed > 300 && newElapsed <= 420 && !hasWarned) { // 5-7 minutes
                  setHasWarned(true);
                  if (!hasAdjusted) {
                    setHasAdjusted(true);
                    if (onTransitionAdjustment) {
                      onTransitionAdjustment(segment, index, newElapsed, 'extend_15min');
                    }
                  }
                }
                
                if (newElapsed >= 420 && !hasErrored) { // ≥ 7 minutes
                  setHasErrored(true);
                  setIsRunning(false);
                  if (onError) onError(segment, index, 'Aplicar tratamiento, posible enfermedad descompresiva');
                }
              } else if (segment.type === 'surface_interval') {
                // Surface Interval logic
                if (newElapsed >= 300 && !hasWarned) { // 5:00
                  setHasWarned(true);
                  if (onWarning) onWarning(segment, index, newElapsed);
                }
                
                if (newElapsed > 420 && !hasErrored) { // 7:00
                  setHasErrored(true);
                  if (onError) onError(segment, index, newElapsed);
                }
                
                // Popup trigger between 5-7 minutes (300-420 seconds)
                if (newElapsed >= 300 && newElapsed <= 420 && !hasTriggeredPopup) {
                  setHasTriggeredPopup(true);
                  if (onPopup) onPopup(segment, index, newElapsed);
                }
              } else if (segment.type === 'travel_shift_vent') {
                // Travel/Shift/Vent logic
                if (newElapsed > 180 && !hasWarned) { // 3:00
                  setHasWarned(true);
                  if (onWarning) onWarning(segment, index, newElapsed);
                }
              }
              
              return newElapsed;
            });
          }
        }, 1000);
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, [isRunning, hasWarned, hasErrored, hasTriggeredPopup, hasAdjusted, segment, index, onWarning, onError, onPopup, onTransitionAdjustment, isCountdownTimer, isTransitionTimer]);

    const startTimer = () => setIsRunning(true);
    const pauseTimer = () => setIsRunning(false);
    const resetTimer = () => {
      setIsRunning(false);
      setElapsedSeconds(0);
      setCountdownSeconds(segment.requiredTime || 0);
      setHasWarned(false);
      setHasErrored(false);
      setHasTriggeredPopup(false);
      setHasAdjusted(false);
    };

    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusColor = () => {
      if (isCountdownTimer) {
        if (countdownSeconds === 0) return 'text-green-600'; // Completed
        if (countdownSeconds <= 60) return 'text-yellow-600'; // Last minute
        return 'text-blue-600';
      } else {
        if (hasErrored) return 'text-red-600';
        if (hasWarned) return 'text-yellow-600';
        return 'text-blue-600';
      }
    };

    const getDisplayTime = () => {
      if (isCountdownTimer) {
        return formatTime(countdownSeconds);
      } else {
        return formatTime(elapsedSeconds);
      }
    };

    const getTimerLabel = () => {
      if (isCountdownTimer) {
        return countdownSeconds === 0 ? '¡COMPLETADO!' : 'Cuenta Regresiva';
      } else if (isTransitionTimer) {
        return 'Cronómetro Transición';
      } else {
        return 'Cronómetro';
      }
    };

    // Don't render if no timer needed
    if (!isCountdownTimer && !isTransitionTimer && !isCountUpTimer) return null;

    // Embedded layout inside timeline boxes (right-aligned)
    if (embedded) {
      return (
        <div className="text-right">
          <div className="text-xs text-slate-500 mb-1">{getTimerLabel()}</div>
          <div className={`text-lg font-mono font-bold ${getStatusColor()}`}>
            {getDisplayTime()}
          </div>
          <div className="flex gap-1 mt-1 justify-end">
            <Button
              onClick={startTimer}
              disabled={isRunning || (isCountdownTimer && countdownSeconds === 0)}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white px-1 py-0.5 text-xs h-6"
            >
              <Play className="w-2 h-2" />
            </Button>
            <Button
              onClick={pauseTimer}
              disabled={!isRunning}
              size="sm"
              variant="outline"
              className="px-1 py-0.5 text-xs h-6"
            >
              <Pause className="w-2 h-2" />
            </Button>
            <Button
              onClick={resetTimer}
              size="sm"
              variant="outline"
              className="px-1 py-0.5 text-xs h-6"
            >
              <RotateCcw className="w-2 h-2" />
            </Button>
          </div>
          
          {/* Status indicators */}
          {isCountdownTimer && countdownSeconds === 0 && (
            <Badge variant="secondary" className="mt-1 text-xs bg-green-100 text-green-800">
              ¡Completado!
            </Badge>
          )}
          
          {(hasWarned || hasErrored) && (
            <Badge variant="secondary" className={`mt-1 text-xs ${hasErrored ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
              {hasErrored ? "Error" : "Advertencia"}
            </Badge>
          )}
          
          {/* Transition-specific messages */}
          {isTransitionTimer && hasWarned && !hasErrored && (
            <div className="mt-1 text-yellow-600 text-xs">
              +15 min añadidos
            </div>
          )}
          
          {isTransitionTimer && hasErrored && (
            <div className="mt-1 text-red-600 text-xs">
              🚨 Aplicar TT
            </div>
          )}
        </div>
      );
    }

    return null; // Only embedded mode is used in this design
  };

  // Handle transition adjustment callback
  const handleTransitionAdjustment = (segment, index, elapsedTime, action) => {
    if (action === 'extend_15min') {
      // Find the adjustable period (first 15m O₂ period) and extend it
      const updatedTimeline = results.timeline.map(item => {
        if (item.isAdjustablePeriod && item.depth === 15) {
          const extendedTime = item.baseTime + (15 * 60); // Add 15 minutes
          return {
            ...item,
            time: extendedTime,
            requiredTime: extendedTime,
            description: `Período 1 de O₂ - 30 min en 15m (extendido por transición >5min)`
          };
        }
        return item;
      });
      
      // Update results with adjusted timeline
      setResults(prev => ({
        ...prev,
        timeline: updatedTimeline
      }));
      
      // Show notification
      setNotificationMessage('Período de 15m extendido automáticamente por tiempo de transición >5 minutos');
      setShowNotification(true);
    }
  };

  const handleTimerWarning = (segment, index, elapsedSeconds) => {
    console.log(`Timer warning: ${segment.type} at ${elapsedSeconds} seconds`);
  };

  const handleTimerError = (segment, index, elapsedSeconds) => {
    console.log(`Timer error: ${segment.type} at ${elapsedSeconds} seconds`);
  };

  const handleTimerPopup = (segment, index, elapsedSeconds) => {
    if (segment.type === 'surface_interval') {
      setPopupData({ segment, index, elapsedSeconds });
      setShowSurDO2Popup(true);
    }
  };

  const handlePopupResponse = (addHalfPeriod) => {
    setShowSurDO2Popup(false);
    
    if (addHalfPeriod && results) {
      // Add half-period (15 min O₂) at 15m to the timeline
      const newTimeline = [...results.timeline];
      
      // Find where to insert the half-period (after compression, before first O₂ period)
      const compressionIndex = newTimeline.findIndex(item => item.type === 'compression');
      if (compressionIndex !== -1) {
        newTimeline.splice(compressionIndex + 1, 0, {
          type: 'o2_period',
          depth: 15,
          time: 15 * 60, // 15 minutes in seconds
          gas: 'O₂',
          description: 'Medio período adicional de O₂ - 15 min en 15m (retraso en transferencia)'
        });
        
        // Update results with modified timeline
        setResults({
          ...results,
          timeline: newTimeline,
          totalTime: results.totalTime + (15 * 60)
        });
      }
    }
    
    setPopupData(null);
  };

  const renderScreen1 = () => (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Calculadora US Navy Rev.7 - Pantalla 1
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Mode Selection */}
        <div>
          <Label htmlFor="mode" className="text-base font-medium text-slate-700">
            Modo de Descompresión *
          </Label>
          <Select value={formData.mode} onValueChange={(value) => setFormData({...formData, mode: value})}>
            <SelectTrigger className={`mt-2 ${errors.mode ? 'border-red-500' : ''}`}>
              <SelectValue placeholder="Seleccione el modo de descompresión" />
            </SelectTrigger>
            <SelectContent>
              {modeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.mode && <p className="text-red-500 text-sm mt-1">{errors.mode}</p>}
        </div>

        {/* Depth */}
        <div>
          <Label htmlFor="depth" className="text-base font-medium text-slate-700">
            Profundidad (metros) *
          </Label>
          <Input
            id="depth"
            type="number"
            min="1"
            step="0.1"
            placeholder="Ingrese la profundidad en metros"
            value={formData.depth}
            onChange={(e) => setFormData({...formData, depth: e.target.value})}
            className={`mt-2 ${errors.depth ? 'border-red-500' : ''}`}
          />
          {errors.depth && <p className="text-red-500 text-sm mt-1">{errors.depth}</p>}
        </div>

        {/* Bottom Time */}
        <div>
          <Label htmlFor="bottomTime" className="text-base font-medium text-slate-700">
            Tiempo de Fondo (minutos) *
          </Label>
          <Input
            id="bottomTime"
            type="number"
            min="1"
            placeholder="Ingrese el tiempo de fondo en minutos"
            value={formData.bottomTime}
            onChange={(e) => setFormData({...formData, bottomTime: e.target.value})}
            className={`mt-2 ${errors.bottomTime ? 'border-red-500' : ''}`}
          />
          {errors.bottomTime && <p className="text-red-500 text-sm mt-1">{errors.bottomTime}</p>}
        </div>

        {/* Altitude */}
        <div>
          <Label htmlFor="altitude" className="text-base font-medium text-slate-700">
            Altitud del sitio (metros)
          </Label>
          <Input
            id="altitude"
            type="number"
            min="0"
            placeholder="0"
            value={formData.altitude}
            onChange={(e) => setFormData({...formData, altitude: e.target.value})}
            className={`mt-2 ${errors.altitude ? 'border-red-500' : ''}`}
          />
          {errors.altitude && <p className="text-red-500 text-sm mt-1">{errors.altitude}</p>}
        </div>

        {/* Depth Gauge Recalibration */}
        {formData.altitude > 0 && (
          <div>
            <Label className="text-base font-medium text-slate-700">
              ¿Se ha recalibrado el medidor de profundidad?
            </Label>
            <Select 
              value={formData.recalibrated ? 'si' : 'no'} 
              onValueChange={(value) => setFormData({...formData, recalibrated: value === 'si'})}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="si">Sí</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Altitude <12h */}
        {formData.altitude > 0 && (
          <div>
            <Label className="text-base font-medium text-slate-700">
              ¿Lleva el buzo más de 12h a esa altitud?
            </Label>
            <Select 
              value={formData.moreThan12hAtAltitude ? 'si' : 'no'} 
              onValueChange={(value) => setFormData({...formData, moreThan12hAtAltitude: value === 'si'})}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="si">Sí</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
            
            {!formData.moreThan12hAtAltitude && (
              <div className="mt-3">
                <Label htmlFor="altitudeArrivalTime" className="text-sm font-medium text-slate-700">
                  Hora de llegada a la altitud *
                </Label>
                <Input
                  id="altitudeArrivalTime"
                  type="datetime-local"
                  value={formData.altitudeArrivalTime}
                  onChange={(e) => setFormData({...formData, altitudeArrivalTime: e.target.value})}
                  className={`mt-1 ${errors.altitudeArrivalTime ? 'border-red-500' : ''}`}
                />
                {errors.altitudeArrivalTime && <p className="text-red-500 text-sm mt-1">{errors.altitudeArrivalTime}</p>}
              </div>
            )}
          </div>
        )}

        {/* Repetitive Dive Section */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <Label className="text-base font-medium text-slate-700 mb-3 block">
            Buceo Repetitivo
          </Label>
          <div className="flex items-center space-x-2 mb-3">
            <input
              type="checkbox"
              id="isRepetitive"
              checked={formData.isRepetitive}
              onChange={(e) => setFormData({...formData, isRepetitive: e.target.checked})}
            />
            <Label htmlFor="isRepetitive" className="text-sm">
              ¿El buzo ha realizado otra inmersión en las 12 horas previas?
            </Label>
          </div>

          {formData.isRepetitive && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Grupo Repetitivo Anterior *</Label>
                <Select 
                  value={formData.repetitiveGroup} 
                  onValueChange={(value) => setFormData({...formData, repetitiveGroup: value})}
                >
                  <SelectTrigger className={`mt-1 ${errors.repetitiveGroup ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Seleccione grupo (A-Z)" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)).map(letter => (
                      <SelectItem key={letter} value={letter}>{letter}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.repetitiveGroup && <p className="text-red-500 text-sm mt-1">{errors.repetitiveGroup}</p>}
              </div>

              <div>
                <Label className="text-sm font-medium">Intervalo en Superficie (minutos) *</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Ej: 120"
                  value={formData.surfaceInterval}
                  onChange={(e) => setFormData({...formData, surfaceInterval: e.target.value})}
                  className={`mt-1 ${errors.surfaceInterval ? 'border-red-500' : ''}`}
                />
                {errors.surfaceInterval && <p className="text-red-500 text-sm mt-1">{errors.surfaceInterval}</p>}
              </div>

              {/* Fields for <10 min rule */}
              {formData.surfaceInterval && parseInt(formData.surfaceInterval) < 10 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-yellow-800 text-sm mb-3">
                    ⚠️ Intervalo &lt;10 min: Se tratará como buceo único combinado
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Tiempo de Fondo Anterior (min) *</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="ej: 30"
                        value={formData.previousBottomTime}
                        onChange={(e) => setFormData({...formData, previousBottomTime: e.target.value})}
                        className={`mt-1 ${errors.previousBottomTime ? 'border-red-500' : ''}`}
                      />
                      {errors.previousBottomTime && <p className="text-red-500 text-sm mt-1">{errors.previousBottomTime}</p>}
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Profundidad Anterior (m) *</Label>
                      <Input
                        type="number"
                        min="1"
                        step="0.1"
                        placeholder="ej: 20"
                        value={formData.previousDepth}
                        onChange={(e) => setFormData({...formData, previousDepth: e.target.value})}
                        className={`mt-1 ${errors.previousDepth ? 'border-red-500' : ''}`}
                      />
                      {errors.previousDepth && <p className="text-red-500 text-sm mt-1">{errors.previousDepth}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleCalculate}
            className="w-full bg-blue-800 hover:bg-blue-900 text-white"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Calcular Plan de Descompresión
              </>
            )}
          </Button>
        </div>
        
        {errors.calculation && (
          <div className={`${errors.isWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4 mt-4`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`h-5 w-5 ${errors.isWarning ? 'text-yellow-600' : 'text-red-600'} flex-shrink-0 mt-0.5`} />
              <div>
                <p className={`${errors.isWarning ? 'text-yellow-700' : 'text-red-700'} text-sm font-medium`}>{errors.calculation}</p>
                {errors.alternatives && errors.alternatives.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-red-600">Modos alternativos disponibles:</p>
                    <div className="flex gap-2 mt-1">
                      {errors.alternatives.map(mode => (
                        <Badge key={mode} variant="outline" className="text-red-600 border-red-300">
                          {modeOptions.find(m => m.value === mode)?.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderTimeline = () => {
    if (!results?.timeline) return null;

    return (
      <div className="space-y-3">
        {results.timeline.map((segment, index) => {
          // Determine background color based on segment type and gas
          let backgroundColor = 'bg-gray-50 border-gray-200'; // default
          
          if (segment.type === 'stop' && segment.gas === 'O₂') {
            backgroundColor = 'bg-green-100 border-green-300'; // O₂ stops in water → bright green
          } else if (segment.type === 'stop' && segment.gas === 'Aire') {
            backgroundColor = 'bg-blue-50 border-blue-200'; // Air stops in water → light blue
          } else if (segment.type === 'o2_period' && segment.gas === 'O₂') {
            backgroundColor = 'bg-green-100 border-green-300'; // O₂ periods in water → bright green
          } else if (segment.type === 'chamber_o2_period' && segment.gas === 'O₂') {
            backgroundColor = 'bg-yellow-100 border-yellow-300'; // Chamber O₂ stops → yellow
          } else if (segment.type === 'surdo2_transfer' || segment.type === 'surdo2_unified_transition') {
            backgroundColor = 'bg-red-100 border-red-300'; // Transfer from 12.2m to chamber → red
          } else if (segment.type === 'ascent') {
            backgroundColor = 'bg-blue-50 border-blue-200';
          } else if (segment.type === 'air_break') {
            backgroundColor = 'bg-yellow-50 border-yellow-200';
          } else if (segment.type === 'compression') {
            backgroundColor = 'bg-purple-50 border-purple-200';
          } else if (segment.type === 'surface_interval') {
            backgroundColor = 'bg-cyan-50 border-cyan-200';
          } else if (segment.type === 'travel_shift_vent') {
            backgroundColor = 'bg-blue-50 border-blue-200';
          }

          return (
            <div key={index}>
              <div className={`border rounded-lg p-4 ${backgroundColor}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {segment.type === 'ascent' && <ArrowRight className="h-4 w-4 text-blue-600" />}
                      {segment.type === 'stop' && <Clock className="h-4 w-4 text-orange-600" />}
                      {(segment.type === 'o2_period' || segment.type === 'chamber_o2_period') && <Timer className="h-4 w-4 text-green-600" />}
                      {segment.type === 'air_break' && <Clock className="h-4 w-4 text-yellow-600" />}
                      {segment.type === 'compression' && <ArrowRight className="h-4 w-4 text-purple-600 rotate-90" />}
                      {segment.type === 'surface_interval' && <AlertCircle className="h-4 w-4 text-cyan-600" />}
                      {segment.type === 'travel_shift_vent' && <Timer className="h-4 w-4 text-blue-600" />}
                      {(segment.type === 'surdo2_transfer' || segment.type === 'surdo2_unified_transition') && <ArrowRight className="h-4 w-4 text-red-600" />}
                      <span className="font-medium text-slate-800">
                        {segment.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {segment.type === 'ascent' || segment.type === 'compression' || segment.type === 'surdo2_transfer' || segment.type === 'surdo2_unified_transition'
                          ? `${segment.fromDepth}m → ${segment.toDepth}m`
                          : `${segment.depth}m`
                        }
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {(segment.isTimer || segment.isTransitionTimer) && segment.timerType === 'countUp' 
                          ? 'Cronómetro' 
                          : USNavyCalculatorService.formatTime(segment.time)
                        }
                      </div>
                      <Badge variant={segment.gas === 'O₂' ? 'default' : 'secondary'}>
                        {segment.gas}
                      </Badge>
                      {segment.speed && (
                        <div className="text-xs text-slate-500">
                          {segment.speed} m/min
                        </div>
                      )}
                    </div>
                    
                    {/* Show transition details for unified SurDO₂ block */}
                    {segment.type === 'surdo2_unified_transition' && segment.details && (
                      <div className="mt-2 text-xs text-slate-600 bg-white bg-opacity-50 p-2 rounded border">
                        <div>• Ascenso {segment.fromDepth}m → Superficie: {USNavyCalculatorService.formatTime(segment.details.ascentTime)} ({segment.details.ascentSpeed} m/min)</div>
                        <div>• Intervalo superficie + Compresión cámara: {USNavyCalculatorService.formatTime(segment.details.compressionTime)}</div>
                        <div className="font-medium text-red-700 mt-1">⚠️ Cronometrar tiempo total de transición</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Timer embedded inside the box on the right side */}
                  {(segment.isTimer || segment.isTransitionTimer || segment.hasCountdownTimer) && (
                    <div className="ml-4 flex-shrink-0">
                      <TimerComponent 
                        segment={segment}
                        index={index}
                        onWarning={handleTimerWarning}
                        onError={handleTimerError}
                        onPopup={handleTimerPopup}
                        onTransitionAdjustment={handleTransitionAdjustment}
                        embedded={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderScreen2 = () => (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-green-900 to-green-700 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Plan de Descompresión - Cronología Completa
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Summary Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Parámetros del Buceo</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Modo:</span> {modeOptions.find(m => m.value === formData.mode)?.label}
              </div>
              <div>
                <span className="font-medium">Profundidad Real:</span> {results?.realDepth}m
              </div>
              {results?.equivalentDepth !== results?.realDepth && (
                <div>
                  <span className="font-medium">Profundidad Equivalente:</span> {results?.equivalentDepth}m
                </div>
              )}
              <div>
                <span className="font-medium">Tiempo de Fondo:</span> {formData.bottomTime} min
              </div>
              {results?.effectiveBottomTime !== parseInt(formData.bottomTime) && (
                <div>
                  <span className="font-medium">Tiempo Efectivo:</span> {results?.effectiveBottomTime} min
                </div>
              )}
              {formData.altitude > 0 && (
                <div>
                  <span className="font-medium">Altitud:</span> {formData.altitude}m
                </div>
              )}
              {results?.altitudeRepetitiveGroup && (
                <div>
                  <span className="font-medium">Grupo por Altitud:</span> {results.altitudeRepetitiveGroup}
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Tabla Utilizada</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Profundidad:</span> {results?.tableDepth}m
              </div>
              <div>
                <span className="font-medium">Tiempo:</span> {results?.tableTime} min
              </div>
              <div>
                <span className="font-medium">Grupo Repetitivo:</span> {results?.repetitiveGroup}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Resumen del Plan</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Tiempo Total:</span> {USNavyCalculatorService.formatTime(results?.totalTime || 0)}
              </div>
              <div>
                <span className="font-medium">Paradas:</span> {
                  results?.timeline?.filter(s => s.type === 'stop' || s.type === 'o2_period').length || 0
                }
              </div>
              <div>
                <span className="font-medium">Referencia:</span> US Navy Rev.7 Ch.9
              </div>
            </div>
          </div>
        </div>

        {/* Altitude Warning */}
        {results?.altitudeWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-700 text-sm font-medium">{results.altitudeWarning}</p>
              </div>
            </div>
          </div>
        )}

        {/* No Decompression Message */}
        {results?.noDecompression && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              Ascenso Directo a Superficie
            </h3>
            <p className="text-green-700">
              Este buceo no requiere paradas de descompresión. Ascienda directamente a superficie a 9 m/min.
            </p>
          </div>
        )}

        {/* Timeline */}
        {!results?.noDecompression && (
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Cronología de Descompresión</h3>
            {renderTimeline()}
          </div>
        )}

        {/* Safety Notes */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-800 mb-2">Recordatorios de Seguridad US Navy Rev.7</h4>
              <ul className="text-red-700 text-sm space-y-1">
                <li>• Siga estrictamente todos los tiempos y profundidades de parada</li>
                <li>• Mantenga velocidades de ascenso: 9 m/min en agua, 30 m/min en cámara</li>
                <li>• Para O₂: máximo 3 min para Travel/Shift/Vent</li>
                <li>• SurDO₂: ventana de transferencia ≤5 min (máx 7 min con modificación)</li>
                <li>• Nunca omita o acorte las paradas de descompresión</li>
                <li>• Para buceos repetitivos: respete los intervalos mínimos en superficie</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button 
            onClick={handleBack}
            variant="outline"
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <Button 
            onClick={handleStartNew}
            className="flex-1 bg-green-800 hover:bg-green-900 text-white"
          >
            Nuevo Cálculo
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // SurDO₂ Popup for transfer delays
  const renderSurDO2Popup = () => {
    if (!showSurDO2Popup || !popupData) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <h3 className="text-lg font-semibold text-orange-800 mb-4">
            Retraso en Transferencia SurDO₂
          </h3>
          <p className="text-orange-700 mb-6">
            Se ha producido un retraso en el tiempo de llegada a 15 m en cámara; según el manual debe sumarse medio periodo a 15 m (Pulse 'Sí' si desea sumarlo o 'No' si desea dejarlo como está).
          </p>
          <div className="flex gap-3">
            <Button 
              onClick={() => handlePopupResponse(true)}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              Sí - Sumar medio período
            </Button>
            <Button 
              onClick={() => handlePopupResponse(false)}
              variant="outline"
              className="flex-1"
            >
              No - Dejar como está
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <img 
            src="/bubblelogo.png" 
            alt="US Navy Rev.7 Chapter 9 Dive Calculator" 
            className="mx-auto mb-4 max-h-24 w-auto"
          />
          <h1 className="text-2xl font-bold text-slate-800">
            Calculadora US Navy Rev.7 Chapter 9
          </h1>
          <p className="text-slate-600">
            Sistema Completo: Aire, O₂ en Agua, SurDO₂, Altitud, Repetitivos y Temporizadores
          </p>
        </div>

        {currentScreen === 1 && renderScreen1()}
        {currentScreen === 2 && renderScreen2()}
        {renderSurDO2Popup()}
      </div>
    </div>
  );
};

export default USNavyDiveCalculator;