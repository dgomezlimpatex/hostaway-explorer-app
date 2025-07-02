
import React from 'react';

export const ProcessingLoader: React.FC = () => {
  return (
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p>Procesando invitación...</p>
    </div>
  );
};
