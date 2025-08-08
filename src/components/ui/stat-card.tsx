import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type StatAccent = 'primary' | 'success' | 'warning' | 'info';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  description?: string;
  icon: React.ElementType;
  accent?: StatAccent;
  className?: string;
  cta?: { label: string; onClick: () => void } | null;
  children?: React.ReactNode; // extra content (e.g., progress)
}

// Utility to map accent to CSS custom properties
function getAccentVars(accent: StatAccent | undefined) {
  const varName =
    accent === 'success' ? '--success' : accent === 'warning' ? '--warning' : accent === 'info' ? '--info' : '--primary';
  return {
    ['--stat-accent' as any]: `hsl(var(${varName}))`,
    ['--stat-accent-soft' as any]: `hsl(var(${varName}) / 0.15)`,
  } as React.CSSProperties;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  accent = 'primary',
  className,
  cta,
  children,
}) => {
  return (
    <div
      className={cn('group rounded-xl p-[1px] transition-shadow hover:shadow-lg', className)}
      style={getAccentVars(accent)}
    >
      <div className="rounded-xl bg-[linear-gradient(135deg,transparent,transparent,rgba(0,0,0,0.02))]">
        <Card className="rounded-xl border border-border/60 bg-card/90 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-base font-medium text-muted-foreground">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--stat-accent-soft)] text-[var(--stat-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold leading-tight text-foreground">{value}</div>
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              {cta && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cta.onClick}
                  className="hover-scale border-[color:var(--stat-accent)] text-[color:var(--stat-accent)] hover:bg-[color:var(--stat-accent-soft)]"
                >
                  {cta.label}
                </Button>
              )}
            </div>

            {children && <div className="mt-4">{children}</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
