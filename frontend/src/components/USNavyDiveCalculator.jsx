import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { AlertTriangle, Calculator, ArrowLeft, ArrowRight, Loader2, Clock, Gauge, Timer, AlertCircle } from 'lucide-react';
import USNavyCalculatorService from '../services/USNavyCalculatorService';

const USNavyDiveCalculator = () => {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSurDO2Popup, setShowSurDO2Popup] = useState(false);
  const [formData, setFormData] = useState({
    mode: '',
    depth: '',
    bottomTime: '',
    altitude: 0,
    recalibrated: false,
    isRepetitive: false,
    repetitiveGroup: '',
    surfaceInterval: '',
    surfaceIntervalSurDO2: 3.5
  });
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState({});
  const [timers, setTimers] = useState({});

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
          surfaceIntervalSurDO2: formData.surfaceIntervalSurDO2
        };

        const result = USNavyCalculatorService.calculateDivePlan(params);
        
        if (result.success) {
          setResults(result);
          setCurrentScreen(2);
        } else {
          setErrors({ 
            calculation: result.error,
            alternatives: result.alternatives 
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
      surfaceIntervalSurDO2: 3.5
    });
    setResults(null);
    setErrors({});
    setTimers({});
  };

  const TimerComponent = ({ segment, index, onTimerComplete, onTimerWarning, onTimerError }) => {
    const [timeLeft, setTimeLeft] = useState(segment.time);
    const [isRunning, setIsRunning] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const intervalRef = useRef(null);

    const startTimer = () => {
      if (isCompleted) return;
      setIsRunning(true);
      
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsCompleted(true);
            if (onTimerComplete) onTimerComplete(segment, index);
            return 0;
          }

          const newTime = prev - 1;
          
          // Check for warnings and errors (for Surface Interval)
          if (segment.type === 'surface_interval') {
            if (newTime === segment.warningTime && onTimerWarning) {
              onTimerWarning(segment, index);
            }
            if (newTime === segment.errorTime && onTimerError) {
              onTimerError(segment, index);
            }
          }

          // Check for Travel/Shift/Vent warnings
          if (segment.type === 'travel_shift_vent' && newTime > 180 && onTimerWarning) {
            onTimerWarning(segment, index);
          }

          return newTime;
        });
      }, 1000);
    };

    const pauseTimer = () => {
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };

    const resetTimer = () => {
      setIsRunning(false);
      setIsCompleted(false);
      setTimeLeft(segment.time);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };

    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getProgressPercentage = () => {
      return ((segment.time - timeLeft) / segment.time) * 100;
    };

    if (!segment.isTimer) return null;

    return (
      <div className="border rounded-lg p-3 bg-yellow-50 border-yellow-200">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-yellow-900 text-sm">
            Temporizador: {segment.description}
          </h4>
          {isCompleted && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Completado
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className={`text-xl font-mono font-bold ${
              isCompleted ? 'text-green-600' : timeLeft < 60 ? 'text-red-600' : 'text-yellow-800'
            }`}>
              {formatTime(timeLeft)}
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  isCompleted ? 'bg-green-500' : timeLeft < 60 ? 'bg-red-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>

          <div className="flex gap-1">
            <Button
              onClick={startTimer}
              disabled={isRunning || isCompleted}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-xs"
            >
              ▶
            </Button>
            
            <Button
              onClick={pauseTimer}
              disabled={!isRunning}
              size="sm"
              variant="outline"
              className="px-2 py-1 text-xs"
            >
              ⏸
            </Button>
            
            <Button
              onClick={resetTimer}
              size="sm"
              variant="outline"
              className="px-2 py-1 text-xs"
            >
              🔄
            </Button>
          </div>
        </div>

        {/* Warning for Travel/Shift/Vent */}
        {segment.type === 'travel_shift_vent' && timeLeft > 180 && (
          <div className="mt-2 text-red-600 text-sm font-medium">
            ⚠️ Excede el máximo de 3 min de Travel/Shift/Vent
          </div>
        )}
      </div>
    );
  };

  const handleTimerWarning = (segment, index) => {
    if (segment.type === 'surface_interval') {
      // Show popup for SurDO₂ delay between 5-7 minutes
      setShowSurDO2Popup(true);
    }
  };

  const handleTimerError = (segment, index) => {
    if (segment.type === 'surface_interval') {
      // Show error for >7 minutes
      alert('Ventana de transferencia excede 7 min: seguir protocolo TT5/TT6');
    }
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

        {/* SurDO₂ Surface Interval */}
        {formData.mode === 'surdo2' && (
          <div>
            <Label htmlFor="surfaceIntervalSurDO2" className="text-base font-medium text-slate-700">
              Intervalo en Superficie SurDO₂ (minutos)
            </Label>
            <Input
              id="surfaceIntervalSurDO2"
              type="number"
              min="1"
              max="7"
              step="0.1"
              placeholder="3.5"
              value={formData.surfaceIntervalSurDO2}
              onChange={(e) => setFormData({...formData, surfaceIntervalSurDO2: parseFloat(e.target.value) || 3.5})}
              className="mt-2"
            />
            <p className="text-sm text-slate-600 mt-1">
              Tiempo desde salir de 12m hasta llegar a 15m en cámara (normal: ~3.5 min, máx: 5 min)
            </p>
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
              Este es un buceo repetitivo
            </Label>
          </div>

          {formData.isRepetitive && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Grupo Repetitivo Anterior</Label>
                <Select 
                  value={formData.repetitiveGroup} 
                  onValueChange={(value) => setFormData({...formData, repetitiveGroup: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccione grupo (A-Z)" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)).map(letter => (
                      <SelectItem key={letter} value={letter}>{letter}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Intervalo en Superficie (minutos)</Label>
                <Input
                  type="number"
                  min="10"
                  placeholder="Ej: 120"
                  value={formData.surfaceInterval}
                  onChange={(e) => setFormData({...formData, surfaceInterval: e.target.value})}
                  className="mt-1"
                />
              </div>
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 text-sm font-medium">{errors.calculation}</p>
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
        {results.timeline.map((segment, index) => (
          <div key={index}>
            <div className={`border rounded-lg p-4 ${
              segment.type === 'ascent' ? 'bg-blue-50 border-blue-200' :
              segment.type === 'stop' ? 'bg-orange-50 border-orange-200' :
              segment.type === 'o2_period' ? 'bg-green-50 border-green-200' :
              segment.type === 'air_break' ? 'bg-yellow-50 border-yellow-200' :
              segment.type === 'compression' ? 'bg-purple-50 border-purple-200' :
              segment.type === 'surface_interval' ? 'bg-cyan-50 border-cyan-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {segment.type === 'ascent' && <ArrowRight className="h-4 w-4 text-blue-600" />}
                    {segment.type === 'stop' && <Clock className="h-4 w-4 text-orange-600" />}
                    {segment.type === 'o2_period' && <Timer className="h-4 w-4 text-green-600" />}
                    {segment.type === 'air_break' && <Clock className="h-4 w-4 text-yellow-600" />}
                    {segment.type === 'compression' && <ArrowRight className="h-4 w-4 text-purple-600 rotate-90" />}
                    {segment.type === 'surface_interval' && <AlertCircle className="h-4 w-4 text-cyan-600" />}
                    <span className="font-medium text-slate-800">
                      {segment.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Gauge className="h-3 w-3" />
                      {segment.type === 'ascent' || segment.type === 'compression'
                        ? `${segment.fromDepth}m → ${segment.toDepth}m`
                        : `${segment.depth}m`
                      }
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {USNavyCalculatorService.formatTime(segment.time)}
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
                </div>
              </div>
            </div>

            {/* Timer Component for segments that need timing */}
            <TimerComponent 
              segment={segment}
              index={index}
              onTimerWarning={handleTimerWarning}
              onTimerError={handleTimerError}
            />
          </div>
        ))}
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
              {formData.altitude > 0 && (
                <div>
                  <span className="font-medium">Altitud:</span> {formData.altitude}m
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
    if (!showSurDO2Popup) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <h3 className="text-lg font-semibold text-orange-800 mb-4">
            Retraso en Transferencia SurDO₂
          </h3>
          <p className="text-orange-700 mb-6">
            Se ha producido un retraso en el tiempo de llegada a 15 m en cámara; según el manual debe sumarse medio periodo a 15 m.
          </p>
          <div className="flex gap-3">
            <Button 
              onClick={() => {
                setShowSurDO2Popup(false);
                // TODO: Add half period to calculation
              }}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              Sí - Sumar medio período
            </Button>
            <Button 
              onClick={() => setShowSurDO2Popup(false)}
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
            Sistema Completo de Descompresión: Aire, O₂ en Agua, SurDO₂, Altitud y Repetitivos
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