import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { AlertTriangle, Waves, Calculator, ArrowLeft, ArrowRight, Loader2, Info, Droplets } from 'lucide-react';
import axios from 'axios';
import DiveTimer from './DiveTimer';
import DepthImage from './DepthImage';
import NotificationManager from './NotificationManager';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DiveCalculator = () => {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [loading, setLoading] = useState(false);
  const [timerStates, setTimerStates] = useState({}); // Persist timer states
  const [formData, setFormData] = useState({
    decompTableType: 'US Navy Rev 7',
    altitude: '',
    breathingGas: 'Aire',
    oxygenDeco: 'No',
    bottomTime: '',
    maxDepth: ''
  });
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState({});

  const validateScreen1 = () => {
    const newErrors = {};
    const altitudeValue = formData.altitude === '' ? 0 : parseFloat(formData.altitude);
    if (altitudeValue < 0) {
      newErrors.altitude = 'La altitud debe ser 0 o mayor';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateScreen2 = () => {
    const newErrors = {};
    if (!formData.bottomTime || formData.bottomTime <= 0) {
      newErrors.bottomTime = 'El tiempo de fondo debe ser un número positivo';
    }
    if (!formData.maxDepth || formData.maxDepth <= 0) {
      newErrors.maxDepth = 'La profundidad máxima debe ser un número positivo';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentScreen === 1 && validateScreen1()) {
      setCurrentScreen(2);
    }
  };

  const handleCalculate = async () => {
    if (validateScreen2()) {
      setLoading(true);
      setErrors({});
      
      try {
        const response = await axios.post(`${API}/decompression/calculate`, {
          maxDepth: parseFloat(formData.maxDepth),
          bottomTime: parseInt(formData.bottomTime),
          altitude: formData.altitude === '' ? 0 : parseFloat(formData.altitude),
          breathingGas: formData.breathingGas,
          oxygenDeco: formData.oxygenDeco
        });
        
        setResults(response.data);
        setCurrentScreen(3);
      } catch (error) {
        console.error('Error calculating decompression:', error);
        let errorMessage = 'Error al calcular la descompresión. Verifique sus datos e intente nuevamente.';
        
        if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail;
        }
        
        setErrors({ calculation: errorMessage });
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
      decompTableType: 'US Navy Rev 7',
      altitude: '',
      breathingGas: 'Aire',
      oxygenDeco: 'No',
      bottomTime: '',
      maxDepth: ''
    });
    setResults(null);
    setErrors({});
  };

  const renderScreen1 = () => (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-700 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Waves className="h-6 w-6" />
          Datos de Inmersión - Pantalla 1 de 3
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div>
          <Label htmlFor="decompTable" className="text-base font-medium text-slate-700">
            Tipo de Tabla de Descompresión
          </Label>
          <div className="mt-2">
            <Badge variant="secondary" className="bg-slate-100 text-slate-800 font-medium px-3 py-1">
              US Navy Rev 7
            </Badge>
            <p className="text-sm text-slate-600 mt-1">Selección fija - Tabla de Aire US Navy Revisión 7</p>
          </div>
        </div>

        <div>
          <Label htmlFor="altitude" className="text-base font-medium text-slate-700">
            Altitud sobre el Nivel del Mar (m)
          </Label>
          <Input
            id="altitude"
            type="number"
            min="0"
            placeholder="Ingrese la altitud en metros (por defecto: 0m)"
            value={formData.altitude}
            onChange={(e) => setFormData({...formData, altitude: e.target.value})}
            className={`mt-2 ${errors.altitude ? 'border-red-500' : ''}`}
          />
          {errors.altitude && <p className="text-red-500 text-sm mt-1">{errors.altitude}</p>}
          <p className="text-sm text-slate-500 mt-1">Si no especifica, se usará 0m (nivel del mar)</p>
        </div>

        <div>
          <Label htmlFor="breathingGas" className="text-base font-medium text-slate-700">
            Gas Respiratorio
          </Label>
          <div className="mt-2">
            <Badge variant="secondary" className="bg-slate-100 text-slate-800 font-medium px-3 py-1">
              Aire
            </Badge>
            <p className="text-sm text-slate-600 mt-1">Selección fija - Gas respiratorio Aire</p>
          </div>
        </div>

        <div>
          <Label htmlFor="oxygenDeco" className="text-base font-medium text-slate-700">
            Descompresión con Oxígeno
          </Label>
          <Select value={formData.oxygenDeco} onValueChange={(value) => setFormData({...formData, oxygenDeco: value})}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Seleccione opción de descompresión con oxígeno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sí">Sí</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleNext} 
            className="w-full bg-slate-800 hover:bg-slate-900 text-white"
          >
            Siguiente <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderScreen2 = () => (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Parámetros de Inmersión - Pantalla 2 de 3
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
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

        <div>
          <Label htmlFor="maxDepth" className="text-base font-medium text-slate-700">
            Profundidad Máxima (m)
          </Label>
          <Input
            id="maxDepth"
            type="number"
            min="1"
            step="0.1"
            placeholder="Ingrese la profundidad máxima en metros"
            value={formData.maxDepth}
            onChange={(e) => setFormData({...formData, maxDepth: e.target.value})}
            className={`mt-2 ${errors.maxDepth ? 'border-red-500' : ''}`}
          />
          {errors.maxDepth && <p className="text-red-500 text-sm mt-1">{errors.maxDepth}</p>}
        </div>

        {/* Informational Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-800 text-sm">
                Las tablas US Navy Rev7 ya son lo suficientemente seguras para buzos que realizan actividad intensa en el fondo o se encuentran excepcionalmente fríos durante la descompresión, no es necesario seleccionar una profundidad o tabla mayor como se hacía con las tablas anteriores.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button 
            onClick={handleBack}
            variant="outline"
            className="flex-1"
            disabled={loading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
          </Button>
          <Button 
            onClick={handleCalculate}
            className="flex-1 bg-blue-800 hover:bg-blue-900 text-white"
            disabled={!formData.bottomTime || !formData.maxDepth || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculando...
              </>
            ) : (
              'Calcular Descompresión'
            )}
          </Button>
        </div>
        
        {errors.calculation && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <p className="text-red-700 text-sm">{errors.calculation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderScreen3 = () => {
    if (errors.calculation) {
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader className="bg-gradient-to-r from-red-900 to-red-700 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              Error de Cálculo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-red-600 mb-4" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                {errors.calculation}
              </h3>
              <p className="text-red-700 mb-6">
                Revise los parámetros de inmersión e intente nuevamente con valores dentro del rango de las tablas.
              </p>
              <Button 
                onClick={handleBack}
                className="bg-red-800 hover:bg-red-900 text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Parámetros
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="w-full max-w-5xl mx-auto">
        <CardHeader className="bg-gradient-to-r from-teal-900 to-teal-700 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Resultados de Descompresión - Pantalla 3 de 3
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <NotificationManager />
          
          {/* Hydration Reminder */}
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Droplets className="h-6 w-6 text-cyan-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-cyan-800 mb-2">¡Recuerda!</h4>
                <p className="text-cyan-700">
                  Hidrátate bien desde que sales del agua: bebe agua o una bebida con electrolitos y sigue hidratándote durante las siguientes horas.
                </p>
              </div>
            </div>
          </div>

          {/* Depth Reference Image */}
          <div className="flex justify-center">
            <DepthImage 
              depth={results?.roundedValues.depth} 
              className="max-w-md"
            />
          </div>

          {/* Time to First Stop Timer */}
          {!results?.noDecompressionDive && results?.timeToFirstStop > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">Tiempo hasta la Primera Parada</h3>
              <DiveTimer
                label="Tiempo hasta la primera parada"
                initialMinutes={results.timeToFirstStop}
                onComplete={() => console.log('Time to first stop completed')}
                className="max-w-md mx-auto"
                isActive={true}
              />
            </div>
          )}

          {/* Decompression Stops with Timers */}
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Paradas de Descompresión</h3>
            {results?.noDecompressionDive ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-semibold text-lg">
                  No se requieren paradas de descompresión.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {results?.decompressionStops.map((stop, index) => (
                  <DiveTimer
                    key={index}
                    label={`Parada en ${stop.depth} m: ${stop.duration} min`}
                    initialMinutes={stop.duration}
                    onComplete={() => console.log(`Stop at ${stop.depth}m completed`)}
                    className=""
                    isActive={false}
                  />
                ))}
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <p className="text-blue-800 font-medium">
                    Sigue el plan. Te avisaremos cuando cada parada termine.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Simplified Dive Summary */}
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Resumen de Inmersión</h3>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">Datos Reales Ingresados:</h4>
                  <p className="text-slate-600">Tiempo de Fondo: {results?.actualInputs.bottomTime} minutos</p>
                  <p className="text-slate-600">Profundidad Máxima: {results?.actualInputs.depth} m</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">Tabulación utilizada:</h4>
                  <p className="text-slate-600">Profundidad: {results?.roundedValues.depth} m</p>
                  <p className="text-slate-600">Tiempo: {results?.roundedValues.time} minutos</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">Tabla Utilizada:</h4>
                  <p className="text-slate-600">US Navy Rev 7 – Tabla de Aire I</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">Grupo Repetitivo:</h4>
                  <p className="text-slate-600">{results?.repetitiveGroup}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Safety Reminder */}
          {!results?.noDecompressionDive && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-800 mb-2">Recordatorio de Seguridad</h4>
                  <p className="text-red-700">
                    Siga todas las paradas exactamente. Ascienda lentamente y realice una parada de seguridad si es recomendado.
                    Nunca exceda la velocidad de ascenso y siempre priorice la seguridad sobre el horario.
                  </p>
                </div>
              </div>
            </div>
          )}

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
              className="flex-1 bg-teal-800 hover:bg-teal-900 text-white"
            >
              Nueva Inmersión
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Calculadora de Descompresión de Buceo
          </h1>
          <p className="text-slate-600 text-lg">
            Tabla de Descompresión de Aire US Navy Rev 7 para Inmersiones Simples
          </p>
        </div>

        {currentScreen === 1 && renderScreen1()}
        {currentScreen === 2 && renderScreen2()}
        {currentScreen === 3 && renderScreen3()}
      </div>
    </div>
  );
};

export default DiveCalculator;