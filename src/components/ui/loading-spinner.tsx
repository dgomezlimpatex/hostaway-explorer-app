
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const sizeConfig = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8', 
  lg: 'h-12 w-12'
};

export const LoadingSpinner = ({ size = 'md', className, text }: LoadingSpinnerProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={cn(
        "animate-spin rounded-full border-2 border-muted border-t-primary",
        sizeConfig[size],
        className
      )} />
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

export const LoadingCard = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="animate-pulse">
      <div className="bg-muted rounded-lg p-4 space-y-3">
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4"></div>
        <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>
        <div className="h-4 bg-muted-foreground/20 rounded w-5/6"></div>
        {children}
      </div>
    </div>
  );
};

export const LoadingGrid = ({ items = 6 }: { items?: number }) => {
  return (
    <div className="grid-responsive">
      {Array.from({ length: items }).map((_, i) => (
        <LoadingCard key={i} />
      ))}
    </div>
  );
};
