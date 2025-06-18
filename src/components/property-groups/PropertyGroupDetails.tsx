
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePropertyAssignments, useCleanerAssignments } from '@/hooks/usePropertyGroups';
import { useProperties } from '@/hooks/useProperties';
import { useCleaners } from '@/hooks/useCleaners';
import { PropertyGroup } from '@/types/propertyGroups';
import { PropertyAssignmentSection } from './PropertyAssignmentSection';
import { CleanerAssignmentSection } from './CleanerAssignmentSection';
import { Edit, Building2, Users, Clock, Settings } from 'lucide-react';

interface PropertyGroupDetailsProps {
  group: PropertyGroup;
  onEdit: () => void;
  onUpdate: () => void;
}

export const PropertyGroupDetails = ({ group, onEdit, onUpdate }: PropertyGroupDetailsProps) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'cleaners'>('properties');

  const { data: propertyAssignments = [] } = usePropertyAssignments(group.id);
  const { data: cleanerAssignments = [] } = useCleanerAssignments(group.id);
  const { data: allProperties = [] } = useProperties();
  const { data: allCleaners = [] } = useCleaners();

  const assignedProperties = allProperties.filter(p => 
    propertyAssignments.some(pa => pa.propertyId === p.id)
  );

  const assignedCleaners = allCleaners.filter(c => 
    cleanerAssignments.some(ca => ca.cleanerId === c.id)
  );

  return (
    <div className="space-y-6">
      {/* Group Info Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {group.name}
              </CardTitle>
              {group.description && (
                <p className="text-gray-600 mt-1">{group.description}</p>
              )}
            </div>
            <Button onClick={onEdit} variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Check-out</p>
                <p className="font-semibold">{group.checkOutTime}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Check-in</p>
                <p className="font-semibold">{group.checkInTime}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Propiedades</p>
                <p className="font-semibold">{assignedProperties.length}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Trabajadoras</p>
                <p className="font-semibold">{assignedCleaners.length}</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            {group.isActive ? (
              <Badge className="bg-green-100 text-green-800">Activo</Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-800">Inactivo</Badge>
            )}
            {group.autoAssignEnabled ? (
              <Badge className="bg-blue-100 text-blue-800">
                <Settings className="h-3 w-3 mr-1" />
                Auto-asignación
              </Badge>
            ) : (
              <Badge className="bg-orange-100 text-orange-800">Manual</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'properties'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('properties')}
        >
          Propiedades ({assignedProperties.length})
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'cleaners'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('cleaners')}
        >
          Personal ({assignedCleaners.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'properties' ? (
        <PropertyAssignmentSection 
          group={group}
          assignedProperties={assignedProperties}
          allProperties={allProperties}
          propertyAssignments={propertyAssignments}
        />
      ) : (
        <CleanerAssignmentSection
          group={group}
          cleanerAssignments={cleanerAssignments}
          allCleaners={allCleaners}
        />
      )}
    </div>
  );
};
