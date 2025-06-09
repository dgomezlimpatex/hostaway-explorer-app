
export interface Task {
  id: string;
  property: string;
  address: string;
  startTime: string;
  endTime: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed';
  checkOut: string;
  checkIn: string;
  cleaner?: string;
  backgroundColor?: string;
  date: string;
}

export interface Cleaner {
  id: string;
  name: string;
  avatar?: string;
  isActive: boolean;
}

export type ViewType = 'day' | 'three-day' | 'week';
