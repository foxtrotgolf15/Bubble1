import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { AlertTriangle, Waves, Calculator, ArrowLeft, ArrowRight } from 'lucide-react';
import { mockCalculateDecompression } from '../mock';

const DiveCalculator = () => {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [formData, setFormData] = useState({
    decompTableType: 'US Navy Rev 7',
    altitude: '',
    breathingGas: 'Air',
    oxygenDeco: 'No',
    bottomTime: '',
    maxDepth: ''
  });
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState({});

  const validateScreen1 = () => {
    const newErrors = {};
    if (!formData.altitude || formData.altitude < 0) {
      newErrors.altitude = 'Altitude must be 0 or greater';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateScreen2 = () => {
    const newErrors = {};
    if (!formData.bottomTime || formData.bottomTime <= 0) {
      newErrors.bottomTime = 'Bottom time must be a positive number';
    }
    if (!formData.maxDepth || formData.maxDepth <= 0) {
      newErrors.maxDepth = 'Maximum depth must be a positive number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentScreen === 1 && validateScreen1()) {
      setCurrentScreen(2);
    }
  };

  const handleCalculate = () => {
    if (validateScreen2()) {
      const calculationResults = mockCalculateDecompression(
        parseFloat(formData.maxDepth),
        parseFloat(formData.bottomTime),
        parseFloat(formData.altitude),
        formData.breathingGas,
        formData.oxygenDeco
      );
      setResults(calculationResults);
      setCurrentScreen(3);
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
      breathingGas: 'Air',
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
          Dive Input - Screen 1 of 3
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div>
          <Label htmlFor="decompTable" className="text-base font-medium text-slate-700">
            Decompression Table Type
          </Label>
          <div className="mt-2">
            <Badge variant="secondary" className="bg-slate-100 text-slate-800 font-medium px-3 py-1">
              US Navy Rev 7
            </Badge>
            <p className="text-sm text-slate-600 mt-1">Fixed selection - US Navy Revision 7 Air Table</p>
          </div>
        </div>

        <div>
          <Label htmlFor="altitude" className="text-base font-medium text-slate-700">
            Altitude Above Sea Level (m)
          </Label>
          <Input
            id="altitude"
            type="number"
            min="0"
            placeholder="Enter altitude in meters"
            value={formData.altitude}
            onChange={(e) => setFormData({...formData, altitude: e.target.value})}
            className={`mt-2 ${errors.altitude ? 'border-red-500' : ''}`}
          />
          {errors.altitude && <p className="text-red-500 text-sm mt-1">{errors.altitude}</p>}
        </div>

        <div>
          <Label htmlFor="breathingGas" className="text-base font-medium text-slate-700">
            Breathing Gas
          </Label>
          <div className="mt-2">
            <Badge variant="secondary" className="bg-slate-100 text-slate-800 font-medium px-3 py-1">
              Air
            </Badge>
            <p className="text-sm text-slate-600 mt-1">Fixed selection - Air breathing gas</p>
          </div>
        </div>

        <div>
          <Label htmlFor="oxygenDeco" className="text-base font-medium text-slate-700">
            Oxygen Decompression
          </Label>
          <Select value={formData.oxygenDeco} onValueChange={(value) => setFormData({...formData, oxygenDeco: value})}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select oxygen decompression option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleNext} 
            className="w-full bg-slate-800 hover:bg-slate-900 text-white"
          >
            Next <ArrowRight className="ml-2 h-4 w-4" />
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
          Dive Parameters - Screen 2 of 3
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div>
          <Label htmlFor="bottomTime" className="text-base font-medium text-slate-700">
            Bottom Time (minutes)
          </Label>
          <Input
            id="bottomTime"
            type="number"
            min="1"
            placeholder="Enter bottom time in minutes"
            value={formData.bottomTime}
            onChange={(e) => setFormData({...formData, bottomTime: e.target.value})}
            className={`mt-2 ${errors.bottomTime ? 'border-red-500' : ''}`}
          />
          {errors.bottomTime && <p className="text-red-500 text-sm mt-1">{errors.bottomTime}</p>}
        </div>

        <div>
          <Label htmlFor="maxDepth" className="text-base font-medium text-slate-700">
            Maximum Depth (m)
          </Label>
          <Input
            id="maxDepth"
            type="number"
            min="1"
            step="0.1"
            placeholder="Enter maximum depth in meters"
            value={formData.maxDepth}
            onChange={(e) => setFormData({...formData, maxDepth: e.target.value})}
            className={`mt-2 ${errors.maxDepth ? 'border-red-500' : ''}`}
          />
          {errors.maxDepth && <p className="text-red-500 text-sm mt-1">{errors.maxDepth}</p>}
        </div>

        <div className="flex gap-4 pt-4">
          <Button 
            onClick={handleBack}
            variant="outline"
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button 
            onClick={handleCalculate}
            className="flex-1 bg-blue-800 hover:bg-blue-900 text-white"
            disabled={!formData.bottomTime || !formData.maxDepth}
          >
            Calculate Decompression
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderScreen3 = () => (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-teal-900 to-teal-700 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6" />
          Decompression Results - Screen 3 of 3
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        {/* Decompression Stops */}
        <div>
          <h3 className="text-xl font-semibold text-slate-800 mb-4">Decompression Stops</h3>
          {results?.noDecompressionDive ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-semibold text-lg">
                No decompression stops required.
              </p>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <ul className="space-y-2">
                {results?.decompressionStops.map((stop, index) => (
                  <li key={index} className="flex items-center text-orange-800 font-medium">
                    <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                    {stop.depth} m for {stop.duration} minutes
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Dive Summary */}
        <div>
          <h3 className="text-xl font-semibold text-slate-800 mb-4">Dive Summary</h3>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-slate-700 mb-3">Actual User Inputs:</h4>
                <p className="text-slate-600">Bottom Time: {results?.actualInputs.bottomTime} minutes</p>
                <p className="text-slate-600">Maximum Depth: {results?.actualInputs.depth} m</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-3">Rounded Values Used:</h4>
                <p className="text-slate-600">Depth: {results?.roundedValues.depth} m</p>
                <p className="text-slate-600">Time: {results?.roundedValues.time} minutes</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-3">Table Used:</h4>
                <p className="text-slate-600">{results?.tableUsed}</p>
                <p className="text-slate-600 text-sm">Depth: {results?.roundedValues.depth}m / Time: {results?.roundedValues.time}min</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-3">Other Parameters:</h4>
                <p className="text-slate-600">Altitude: {results?.altitude} m</p>
                <p className="text-slate-600">Breathing Gas: {results?.breathingGas}</p>
                <p className="text-slate-600">Oxygen Deco: {results?.oxygenDeco}</p>
                <p className="text-slate-600">Total Ascent Time: {results?.totalAscentTime}</p>
                <p className="text-slate-600">Repetitive Group: {results?.repetitiveGroup}</p>
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
                <h4 className="font-semibold text-red-800 mb-2">Safety Reminder</h4>
                <p className="text-red-700">
                  Follow all stops exactly. Ascend slowly and perform a safety stop if recommended.
                  Never exceed the ascent rate and always prioritize safety over schedule.
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
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
          <Button 
            onClick={handleStartNew}
            className="flex-1 bg-teal-800 hover:bg-teal-900 text-white"
          >
            Start New Dive
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Dive Decompression Calculator
          </h1>
          <p className="text-slate-600 text-lg">
            US Navy Rev 7 Air Decompression Table for Simple Dives
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