import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Package, 
  Calendar, 
  FileText, 
  Building2, 
  Eye, 
  Edit, 
  MoreVertical,
  Clock,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LogisticsCardProps {
  type: 'picklist' | 'delivery' | 'package';
  id: string;
  code?: string;
  status: string;
  title: string;
  subtitle?: string;
  scheduledDate?: string | null;
  notes?: string | null;
  priority?: 'low' | 'normal' | 'high';
  itemCount?: number;
  propertyCode?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

const statusConfig = {
  draft: { 
    color: 'bg-secondary/20 text-secondary-foreground border-secondary/30',
    label: 'Borrador',
    icon: FileText
  },
  preparing: { 
    color: 'bg-warning/20 text-warning-foreground border-warning/30',
    label: 'Preparando',
    icon: Clock
  },
  packed: { 
    color: 'bg-info/20 text-info-foreground border-info/30',
    label: 'Empacada',
    icon: Package
  },
  committed: { 
    color: 'bg-success/20 text-success-foreground border-success/30',
    label: 'Confirmada',
    icon: CheckCircle2
  },
  cancelled: { 
    color: 'bg-destructive/20 text-destructive-foreground border-destructive/30',
    label: 'Cancelada',
    icon: AlertTriangle
  },
  planned: { 
    color: 'bg-primary/20 text-primary-foreground border-primary/30',
    label: 'Planificada',
    icon: Calendar
  },
  completed: { 
    color: 'bg-success/20 text-success-foreground border-success/30',
    label: 'Completada',
    icon: CheckCircle2
  }
} as const;

const priorityConfig = {
  low: { color: 'bg-muted text-muted-foreground', label: 'Baja' },
  normal: { color: 'bg-primary/10 text-primary', label: 'Normal' },
  high: { color: 'bg-destructive/10 text-destructive', label: 'Alta' }
} as const;

export const LogisticsCard: React.FC<LogisticsCardProps> = ({
  type,
  id,
  code,
  status,
  title,
  subtitle,
  scheduledDate,
  notes,
  priority = 'normal',
  itemCount,
  propertyCode,
  onEdit,
  onDelete,
  className
}) => {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
  const StatusIcon = config.icon;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getViewUrl = () => {
    switch (type) {
      case 'picklist':
        return `/logistics/picklists/${id}`;
      case 'delivery':
        return `/logistics/deliveries/${id}`;
      case 'package':
        return `/logistics/packages/${id}`;
      default:
        return '#';
    }
  };

  const getEditUrl = () => {
    switch (type) {
      case 'picklist':
        return `/logistics/picklists/${id}/edit`;
      case 'delivery':
        return `/logistics/deliveries/${id}/edit`;
      default:
        return '#';
    }
  };

  return (
    <Card className={cn(
      "group relative overflow-hidden border-0 shadow-sm hover-lift transition-all duration-300",
      "bg-gradient-to-br from-card to-card/80",
      "hover:shadow-lg hover:shadow-primary/5",
      className
    )}>
      {/* Priority indicator */}
      {priority === 'high' && (
        <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 mb-1">
              {type === 'picklist' && <Package className="h-5 w-5 text-primary flex-shrink-0" />}
              {type === 'delivery' && <Building2 className="h-5 w-5 text-primary flex-shrink-0" />}
              {type === 'package' && <Package className="h-5 w-5 text-primary flex-shrink-0" />}
              <span className="truncate">{title}</span>
              {code && (
                <Badge variant="outline" className="ml-auto flex-shrink-0 text-xs">
                  {code}
                </Badge>
              )}
            </CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        
        {/* Status and priority */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge 
            className={cn(
              "text-xs font-medium border px-2 py-1 flex items-center gap-1.5",
              config.color
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
          
          {priority !== 'normal' && (
            <Badge 
              variant="outline" 
              className={cn("text-xs", priorityConfig[priority].color)}
            >
              {priorityConfig[priority].label}
            </Badge>
          )}
          
          {itemCount !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {itemCount} items
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Metadata */}
        <div className="space-y-2">
          {scheduledDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>Fecha: {formatDate(scheduledDate)}</span>
            </div>
          )}
          
          {propertyCode && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span>Propiedad: {propertyCode}</span>
            </div>
          )}
          
          {notes && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2 leading-relaxed">{notes}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <Button 
            asChild 
            size="sm" 
            className="flex-1 mr-2 h-8 text-xs font-medium"
          >
            <Link to={getViewUrl()} className="flex items-center justify-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Ver detalles
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {onEdit && (
                <DropdownMenuItem asChild>
                  <Link to={getEditUrl()} className="flex items-center gap-2 text-sm">
                    <Edit className="h-4 w-4" />
                    Editar
                  </Link>
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive text-sm"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};