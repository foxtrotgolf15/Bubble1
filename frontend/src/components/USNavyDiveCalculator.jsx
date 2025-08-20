import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { AlertTriangle, Calculator, ArrowLeft, ArrowRight, Loader2, Clock, Gauge } from 'lucide-react';
import USNavyCalculatorService from '../services/USNavyCalculatorService';

const USNavyDiveCalculator = () => {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    mode: '',
    depth: '',
    bottomTime: '',
    altitude: 0,
    recalibrated: false,
    isRepetitive: false,
    repetitiveGroup: '',
    surfaceInterval: ''
  });
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState({});

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
          recalibrated: formData.recalibrated
        };

        const result = USNavyCalculatorService.calculateDivePlan(params);
        
        if (result.success) {
          setResults(result);
          setCurrentScreen(2);
        } else {
          setErrors({ calculation: result.error });
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
      surfaceInterval: ''
    });
    setResults(null);
    setErrors({});
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
            Modo de Descompresión
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
            Profundidad (metros)
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
            Tiempo de Fondo (minutos)
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

        {/* Repetitive Dive Section - TODO: Implement fully */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <Label className="text-base font-medium text-slate-700 mb-3 block">
            Buceo Repetitivo (Próximamente)
          </Label>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isRepetitive"
              checked={formData.isRepetitive}
              onChange={(e) => setFormData({...formData, isRepetitive: e.target.checked})}
              disabled
            />
            <Label htmlFor="isRepetitive" className="text-sm text-gray-500">
              Este es un buceo repetitivo
            </Label>
          </div>
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
              <p className="text-red-700 text-sm">{errors.calculation}</p>
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
          <div key={index} className={`border rounded-lg p-4 ${
            segment.type === 'ascent' ? 'bg-blue-50 border-blue-200' :
            segment.type === 'stop' ? 'bg-orange-50 border-orange-200' :
            segment.type === 'break' ? 'bg-yellow-50 border-yellow-200' :
            'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {segment.type === 'ascent' && <ArrowRight className="h-4 w-4 text-blue-600" />}
                  {segment.type === 'stop' && <Clock className="h-4 w-4 text-orange-600" />}
                  {segment.type === 'break' && <Clock className="h-4 w-4 text-yellow-600" />}
                  <span className="font-medium text-slate-800">
                    {segment.description}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Gauge className="h-3 w-3" />
                    {segment.type === 'ascent' 
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
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderScreen2 = () => (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-green-900 to-green-700 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Plan de Descompresión - Cronología
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Summary Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <h3 className="font-semibold text-slate-800 mb-3">Resumen del Plan</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Tiempo Total de Ascenso:</span> {USNavyCalculatorService.formatTime(results?.totalTime || 0)}
              </div>
              <div>
                <span className="font-medium">Número de Paradas:</span> {
                  results?.timeline?.filter(s => s.type === 'stop').length || 0
                }
              </div>
              <div>
                <span className="font-medium">Tabla Utilizada:</span> US Navy Rev.7 Chapter 9
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
              <h4 className="font-semibold text-red-800 mb-2">Recordatorios de Seguridad</h4>
              <ul className="text-red-700 text-sm space-y-1">
                <li>• Siga estrictamente todos los tiempos y profundidades de parada</li>
                <li>• Mantenga velocidad de ascenso de 9 m/min en agua</li>
                <li>• Nunca omita o acorte las paradas de descompresión</li>
                <li>• En caso de emergencia, siga los protocolos de seguridad establecidos</li>
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
            Sistema completo de descompresión con aire, oxígeno y superficie
          </p>
        </div>

        {currentScreen === 1 && renderScreen1()}
        {currentScreen === 2 && renderScreen2()}
      </div>
    </div>
  );
};

export default USNavyDiveCalculator;