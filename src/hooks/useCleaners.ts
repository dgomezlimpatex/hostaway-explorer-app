
import { useQuery } from '@tanstack/react-query';
import { Cleaner } from '@/types/calendar';

export const useCleaners = () => {
  const { data: cleaners = [], isLoading } = useQuery({
    queryKey: ['cleaners'],
    queryFn: async () => {
      const mockCleaners: Cleaner[] = [
        { id: '1', name: 'María García', isActive: true },
        { id: '2', name: 'Ana López', isActive: true },
        { id: '3', name: 'Carlos Ruiz', isActive: true },
        { id: '4', name: 'Jhoana Quintero', isActive: true },
        { id: '5', name: 'Jaritza', isActive: true },
        { id: '6', name: 'Lali Freire', isActive: true },
        { id: '7', name: 'Katerine Samboni', isActive: true },
        { id: '8', name: 'Thalia Martínez', isActive: true }
      ];
      return mockCleaners;
    },
  });

  return {
    cleaners,
    isLoading
  };
};
