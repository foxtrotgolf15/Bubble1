import React, { useEffect, useState } from 'react';
import { AlertCircle, Settings } from 'lucide-react';
import { Button } from './ui/button';

const NotificationManager = () => {
  const [notificationStatus, setNotificationStatus] = useState('unknown');
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = () => {
    if (!('Notification' in window)) {
      setNotificationStatus('unsupported');
      return;
    }

    const permission = Notification.permission;
    setNotificationStatus(permission);

    if (permission === 'denied') {
      setShowBanner(true);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      
      if (permission === 'denied') {
        setShowBanner(true);
      } else {
        setShowBanner(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
  };

  if (!showBanner || notificationStatus === 'granted') {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-yellow-800 text-sm font-medium">
            Notificaciones deshabilitadas
          </p>
          <p className="text-yellow-700 text-sm mt-1">
            Actívalas en ajustes para recibir alertas de finalización de paradas.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={requestNotificationPermission}
              size="sm"
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Settings className="w-4 h-4 mr-1" />
              Activar Notificaciones
            </Button>
            <Button
              onClick={dismissBanner}
              size="sm"
              variant="outline"
              className="text-yellow-700 border-yellow-300"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationManager;