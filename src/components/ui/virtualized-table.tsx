
import React, { memo, useMemo } from 'react';
import { useVirtualization } from '@/hooks/useVirtualization';

interface VirtualizedTableProps<T> {
  data: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T & { index: number }) => React.ReactNode;
  className?: string;
  overscan?: number;
}

function VirtualizedTableComponent<T>({
  data,
  height,
  itemHeight,
  renderItem,
  className = '',
  overscan = 5
}: VirtualizedTableProps<T>) {
  const {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll
  } = useVirtualization({
    items: data,
    itemHeight,
    containerHeight: height,
    overscan
  });

  const memoizedItems = useMemo(() => {
    return visibleItems.map((item, index) => (
      <div key={item.index || index} style={{ height: itemHeight }}>
        {renderItem(item)}
      </div>
    ));
  }, [visibleItems, itemHeight, renderItem]);

  return (
    <div 
      className={`overflow-auto ${className}`}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {memoizedItems}
        </div>
      </div>
    </div>
  );
}

export const VirtualizedTable = memo(VirtualizedTableComponent) as typeof VirtualizedTableComponent;
