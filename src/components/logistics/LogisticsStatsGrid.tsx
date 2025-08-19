import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  change?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  icon: LucideIcon;
  color?: 'primary' | 'success' | 'warning' | 'info' | 'destructive';
  loading?: boolean;
}

const colorConfig = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    badge: 'bg-primary/20 text-primary'
  },
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    badge: 'bg-success/20 text-success'
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    badge: 'bg-warning/20 text-warning'
  },
  info: {
    bg: 'bg-info/10',
    text: 'text-info',
    badge: 'bg-info/20 text-info'
  },
  destructive: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    badge: 'bg-destructive/20 text-destructive'
  }
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  color = 'primary',
  loading = false
}) => {
  const config = colorConfig[color];

  return (
    <Card className="overflow-hidden shadow-sm hover-lift border-0 bg-gradient-to-br from-card to-card/80">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-3 rounded-xl flex-shrink-0", config.bg)}>
            <Icon className={cn("h-6 w-6", config.text)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground mb-1 truncate">
              {title}
            </p>
            
            {loading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-foreground">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
                
                {change && (
                  <Badge 
                    variant="outline"
                    className={cn(
                      "text-xs font-medium",
                      change.positive ? "text-success border-success/30" : "text-destructive border-destructive/30"
                    )}
                  >
                    {change.positive ? '+' : ''}{change.value}% {change.label}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface LogisticsStatsGridProps {
  stats: Array<StatCardProps>;
  loading?: boolean;
  className?: string;
}

export const LogisticsStatsGrid: React.FC<LogisticsStatsGridProps> = ({
  stats,
  loading = false,
  className
}) => {
  return (
    <div className={cn(
      "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4",
      className
    )}>
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          {...stat}
          loading={loading}
        />
      ))}
    </div>
  );
};