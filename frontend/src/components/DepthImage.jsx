import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

const DepthImage = ({ depth, className = "" }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Try different extensions
  const possibleExtensions = ['png', 'jpg', 'jpeg'];
  const [currentExtensionIndex, setCurrentExtensionIndex] = useState(0);

  const getImagePath = (extensionIndex = 0) => {
    const extension = possibleExtensions[extensionIndex];
    return `/depth-images/${depth}.${extension}`;
  };

  const handleImageError = () => {
    const nextExtensionIndex = currentExtensionIndex + 1;
    
    if (nextExtensionIndex < possibleExtensions.length) {
      // Try next extension
      setCurrentExtensionIndex(nextExtensionIndex);
      setImageLoading(true);
    } else {
      // All extensions failed, show placeholder
      setImageError(true);
      setImageLoading(false);
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  if (imageError) {
    return (
      <div className={`border border-gray-300 rounded-lg p-8 text-center bg-gray-50 ${className}`}>
        <ImageOff className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 font-medium">
          Image for {depth} m not available
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Imagen de referencia no encontrada
        </p>
      </div>
    );
  }

  return (
    <div className={`text-center ${className}`}>
      {imageLoading && (
        <div className="border border-gray-300 rounded-lg p-8 bg-gray-50 animate-pulse">
          <div className="w-full h-32 bg-gray-300 rounded"></div>
          <p className="text-gray-500 mt-2">Cargando imagen...</p>
        </div>
      )}
      
      <img
        src={getImagePath(currentExtensionIndex)}
        alt={`Tabla de descompresión para profundidad ${depth} metros`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        className={`max-w-full h-auto border border-gray-300 rounded-lg shadow-sm ${
          imageLoading ? 'hidden' : ''
        }`}
      />
      
      {!imageLoading && !imageError && (
        <p className="text-sm text-slate-600 mt-2 font-medium">
          Referencia de profundidad: {depth} m
        </p>
      )}
    </div>
  );
};

export default DepthImage;