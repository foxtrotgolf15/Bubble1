import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Play, Pause, RotateCcw, Bell } from 'lucide-react';
import { Badge } from './ui/badge';

const DiveTimer = ({ 
  label, 
  initialMinutes, 
  onComplete, 
  className = "",
  isActive = false 
}) => {
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60); // Convert to seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // Create audio element for alarm
    audioRef.current = new Audio();
    audioRef.current.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+D0u2cbCjaL0fPTgjEGHm7A7+OZSA0PVqzn77BdGAg+ltryxnkpBSl+zPLZizoIGGS57OWYTgwOUarm7a5ZFAZBE4X5';
    audioRef.current.volume = 0.7;
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning && !isCompleted && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            setIsRunning(false);
            setIsCompleted(true);
            handleTimerComplete();
            return 0;
          }
          return prevTime - 1;
        });
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
  }, [isRunning, isCompleted, timeLeft]);

  const handleTimerComplete = () => {
    // Play alarm sound
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }

    // Send notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Parada de Descompresión Completada', {
        body: `${label} ha terminado`,
        icon: '/favicon.ico',
        tag: 'decompression-timer'
      });
    }

    // Callback
    if (onComplete) {
      onComplete();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (!isCompleted) {
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsCompleted(false);
    setTimeLeft(initialMinutes * 60);
  };

  const getProgressPercentage = () => {
    const totalSeconds = initialMinutes * 60;
    return ((totalSeconds - timeLeft) / totalSeconds) * 100;
  };

  return (
    <div className={`p-4 border rounded-lg ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-slate-700 text-sm">{label}</h4>
        {isCompleted && (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <Bell className="w-3 h-3 mr-1" />
            Completado
          </Badge>
        )}
      </div>
      
      <div className="text-center mb-3">
        <div className={`text-2xl font-mono font-bold ${
          isCompleted ? 'text-green-600' : timeLeft < 60 ? 'text-red-600' : 'text-slate-800'
        }`}>
          {formatTime(timeLeft)}
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div 
            className={`h-2 rounded-full transition-all duration-1000 ${
              isCompleted ? 'bg-green-500' : timeLeft < 60 ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        <Button
          onClick={handleStart}
          disabled={isRunning || isCompleted}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          <Play className="w-4 h-4 mr-1" />
          Iniciar
        </Button>
        
        <Button
          onClick={handlePause}
          disabled={!isRunning}
          size="sm"
          variant="outline"
        >
          <Pause className="w-4 h-4 mr-1" />
          Pausar
        </Button>
        
        <Button
          onClick={handleReset}
          size="sm"
          variant="outline"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Reiniciar
        </Button>
      </div>
    </div>
  );
};

export default DiveTimer;