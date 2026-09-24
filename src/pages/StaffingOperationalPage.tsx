import { Navigate, useParams } from 'react-router-dom';
import { StaffingOperationalWorkspace, type StaffingOperationalScreen } from '@/features/staffing/StaffingOperationalWorkspace';

const screens: StaffingOperationalScreen[] = ['home', 'forecast', 'team', 'shifts', 'centers', 'reports', 'settings'];

export default function StaffingOperationalPage() {
  const { screen } = useParams<{ screen: string }>();
  if (!screens.includes(screen as StaffingOperationalScreen)) {
    return <Navigate to="/staffing-forecast/screens/home" replace />;
  }
  return <StaffingOperationalWorkspace screen={screen as StaffingOperationalScreen} />;
}
