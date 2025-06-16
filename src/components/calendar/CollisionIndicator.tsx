
import { memo } from "react";
import { cn } from "@/lib/utils";

interface CollisionIndicatorProps {
  isColliding: boolean;
  collisionCount: number;
}

export const CollisionIndicator = memo(({ isColliding, collisionCount }: CollisionIndicatorProps) => {
  if (!isColliding || collisionCount <= 1) return null;

  return (
    <div className="absolute top-0 right-0 z-20">
      <div className={cn(
        "w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white shadow-md",
        collisionCount === 2 ? "bg-amber-500" : "bg-red-500"
      )}>
        {collisionCount}
      </div>
    </div>
  );
});

CollisionIndicator.displayName = "CollisionIndicator";
