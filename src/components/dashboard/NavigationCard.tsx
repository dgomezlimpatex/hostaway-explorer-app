
import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface NavigationCardProps {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  gradientFrom: string;
  gradientTo: string;
  iconColor: string;
  hoverBorderColor: string;
}

export const NavigationCard = ({
  to,
  title,
  description,
  icon: Icon,
  gradientFrom,
  gradientTo,
  iconColor,
  hoverBorderColor
}: NavigationCardProps) => {
  return (
    <Link to={to} className="group transform transition-all duration-300 hover:scale-105">
      <div className={`bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl ${hoverBorderColor} transition-all duration-300`}>
        <div className={`${gradientFrom} ${gradientTo} w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`h-8 w-8 ${iconColor}`} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
        <p className="text-gray-600 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
};
