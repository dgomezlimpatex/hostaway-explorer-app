import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { MediaCapture } from './MediaCapture';
interface Issue {
  id: string;
  type: 'damage' | 'missing' | 'maintenance' | 'cleanliness' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
  media_urls: string[];
}
interface IssuesSectionProps {
  issues: Issue[];
  onIssuesChange: (issues: Issue[]) => void;
  reportId?: string;
  isReadOnly?: boolean;
}
export const IssuesSection: React.FC<IssuesSectionProps> = ({
  issues,
  onIssuesChange,
  reportId,
  isReadOnly = false
}) => {
  const [newIssue, setNewIssue] = useState<Partial<Issue>>({
    type: 'other',
    severity: 'low',
    description: '',
    media_urls: []
  });
  const issueTypes = [{
    value: 'damage',
    label: 'Daño'
  }, {
    value: 'missing',
    label: 'Artículo faltante'
  }, {
    value: 'maintenance',
    label: 'Mantenimiento'
  }, {
    value: 'cleanliness',
    label: 'Problema de limpieza'
  }, {
    value: 'other',
    label: 'Otro'
  }];
  const severityLevels = [{
    value: 'low',
    label: 'Bajo',
    color: 'bg-green-100 text-green-800'
  }, {
    value: 'medium',
    label: 'Medio',
    color: 'bg-yellow-100 text-yellow-800'
  }, {
    value: 'high',
    label: 'Alto',
    color: 'bg-red-100 text-red-800'
  }];
  const addIssue = () => {
    if (!newIssue.description?.trim()) return;
    const issue: Issue = {
      id: `issue-${Date.now()}`,
      type: newIssue.type as Issue['type'],
      description: newIssue.description,
      severity: newIssue.severity as Issue['severity'],
      media_urls: newIssue.media_urls || []
    };
    console.log('IssuesSection - adding new issue:', issue);
    onIssuesChange([...issues, issue]);
    setNewIssue({
      type: 'other',
      severity: 'low',
      description: '',
      media_urls: []
    });
  };
  const removeIssue = (issueId: string) => {
    onIssuesChange(issues.filter(issue => issue.id !== issueId));
  };
  const handleNewIssueMediaAdded = (mediaUrl: string) => {
    console.log('IssuesSection - adding media to new issue:', mediaUrl);
    setNewIssue(prev => ({
      ...prev,
      media_urls: [...(prev.media_urls || []), mediaUrl]
    }));
  };
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Incidencias Reportadas</h3>
        <Badge variant="outline">
          {issues.length} incidencia{issues.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Incidencias existentes */}
      {issues.length > 0 && <div className="space-y-4">
          {issues.map(issue => {
        const severityConfig = severityLevels.find(s => s.value === issue.severity);
        const typeConfig = issueTypes.find(t => t.value === issue.type);
        return <Card key={issue.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <CardTitle className="text-md">{typeConfig?.label}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={severityConfig?.color}>
                        {severityConfig?.label}
                      </Badge>
                      {!isReadOnly && (
                        <Button variant="destructive" size="sm" onClick={() => removeIssue(issue.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-3">{issue.description}</p>
                  
                  {issue.media_urls.length > 0 && <div className="flex flex-wrap gap-2">
                      {issue.media_urls.map((url, index) => <div key={index} className="w-20 h-20 bg-gray-100 rounded border overflow-hidden">
                          <img src={url} alt={`Evidencia ${index + 1}`} className="w-full h-full object-cover" />
                        </div>)}
                    </div>}
                </CardContent>
              </Card>;
      })}
        </div>}

      {/* Formulario para nueva incidencia */}
      {!isReadOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-md">Reportar Nueva Incidencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo de Incidencia</label>
                <Select value={newIssue.type} onValueChange={value => setNewIssue(prev => ({
                ...prev,
                type: value as Issue['type']
              }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {issueTypes.map(type => <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Gravedad</label>
                <Select value={newIssue.severity} onValueChange={value => setNewIssue(prev => ({
                ...prev,
                severity: value as Issue['severity']
              }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {severityLevels.map(severity => <SelectItem key={severity.value} value={severity.value}>
                        {severity.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Descripción</label>
              <Textarea placeholder="Describe el problema encontrado..." value={newIssue.description} onChange={e => setNewIssue(prev => ({
              ...prev,
              description: e.target.value
            }))} className="min-h-[100px]" />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Evidencia Fotográfica</label>
              <MediaCapture onMediaCaptured={handleNewIssueMediaAdded} reportId={reportId} checklistItemId={`issue-${Date.now()}`} existingMedia={newIssue.media_urls} />
            </div>

            <Button onClick={addIssue} disabled={!newIssue.description?.trim()} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Incidencia
            </Button>
          </CardContent>
        </Card>
      )}

      {issues.length === 0 && <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>INCIDENCIAS GRAVES</p>
          <p className="text-sm">REPORTAD CUANTO ANTES A SUPERVISOR</p>
        </div>}
    </div>;
};