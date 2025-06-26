
import React from 'react';
import { Clock, Calendar } from 'lucide-react';

interface TaskCardTimeInfoProps {
  startTime: string;
  endTime: string;
  date: string;
}

export const TaskCardTimeInfo: React.FC<TaskCardTimeInfoProps> = ({
  startTime,
  endTime,
  date,
}) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
        <Clock className="h-4 w-4 text-gray-500" />
        <div className="text-sm">
          <div className="font-semibold text-gray-900">
            {startTime} - {endTime}
          </div>
          <div className="text-gray-500 text-xs">Horario</div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
        <Calendar className="h-4 w-4 text-gray-500" />
        <div className="text-sm">
          <div className="font-semibold text-gray-900">{date}</div>
          <div className="text-gray-500 text-xs">Fecha</div>
        </div>
      </div>
    </div>
  );
};
