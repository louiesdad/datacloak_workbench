import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './VirtualScrollList.css';

export interface VirtualScrollListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  testId?: string;
  onScroll?: (scrollTop: number) => void;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualScrollList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  testId,
  onScroll,
  getItemKey = (_, index) => index
}: VirtualScrollListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const { startIndex, endIndex, visibleItems } = useMemo(() => {
    const containerItemCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length - 1,
      start + containerItemCount + overscan * 2
    );

    return {
      startIndex: start,
      endIndex: end,
      visibleItems: items.slice(start, end + 1)
    };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // Scroll to index
  const scrollToIndex = useCallback((index: number) => {
    if (scrollElementRef.current) {
      const scrollTop = index * itemHeight;
      scrollElementRef.current.scrollTop = scrollTop;
      setScrollTop(scrollTop);
    }
  }, [itemHeight]);

  // Calculate total height and offset
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={scrollElementRef}
      className={`virtual-scroll-list ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
      data-testid={testId}
    >
      <div
        className="virtual-scroll-spacer"
        style={{ height: totalHeight }}
      >
        <div
          className="virtual-scroll-content"
          style={{ transform: `translateY(${offsetY}px)` }}
        >
          {visibleItems.map((item, virtualIndex) => {
            const actualIndex = startIndex + virtualIndex;
            return (
              <div
                key={getItemKey(item, actualIndex)}
                className="virtual-scroll-item"
                style={{ height: itemHeight }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Table-specific virtual scroll component
export interface VirtualTableProps<T> {
  data: T[];
  columns: Array<{
    key: string;
    header: string;
    width?: number;
    render?: (value: any, item: T, index: number) => React.ReactNode;
  }>;
  rowHeight?: number;
  height: number;
  className?: string;
  testId?: string;
  onRowClick?: (item: T, index: number) => void;
  selectedRows?: Set<number>;
}

export function VirtualTable<T extends Record<string, any>>({
  data,
  columns,
  rowHeight = 48,
  height,
  className = '',
  testId,
  onRowClick,
  selectedRows
}: VirtualTableProps<T>) {
  const renderRow = useCallback((item: T, index: number) => (
    <div
      className={`virtual-table-row ${selectedRows?.has(index) ? 'selected' : ''} ${
        onRowClick ? 'clickable' : ''
      }`}
      onClick={() => onRowClick?.(item, index)}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className="virtual-table-cell"
          style={{ width: column.width || 'auto' }}
        >
          {column.render
            ? column.render(item[column.key], item, index)
            : item[column.key]
          }
        </div>
      ))}
    </div>
  ), [columns, onRowClick, selectedRows]);

  return (
    <div className={`virtual-table ${className}`} data-testid={testId}>
      {/* Table header */}
      <div className="virtual-table-header">
        {columns.map((column) => (
          <div
            key={column.key}
            className="virtual-table-header-cell"
            style={{ width: column.width || 'auto' }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Virtual scrolled body */}
      <VirtualScrollList
        items={data}
        itemHeight={rowHeight}
        containerHeight={height - 48} // Subtract header height
        renderItem={renderRow}
        className="virtual-table-body"
        testId={`${testId}-body`}
        getItemKey={(_, index) => index}
      />
    </div>
  );
}

// Performance-optimized component for large lists
export interface PerformantListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimatedItemHeight?: number;
  height: number;
  threshold?: number; // Switch to virtual scrolling after this many items
  className?: string;
  testId?: string;
}

export function PerformantList<T>({
  items,
  renderItem,
  estimatedItemHeight = 60,
  height,
  threshold = 100,
  className = '',
  testId
}: PerformantListProps<T>) {
  // Use virtual scrolling for large lists
  const shouldVirtualize = items.length > threshold;

  if (shouldVirtualize) {
    return (
      <VirtualScrollList
        items={items}
        itemHeight={estimatedItemHeight}
        containerHeight={height}
        renderItem={renderItem}
        className={className}
        testId={testId}
      />
    );
  }

  // Regular rendering for small lists
  return (
    <div
      className={`performant-list ${className}`}
      style={{ height, overflowY: 'auto' }}
      data-testid={testId}
    >
      {items.map((item, index) => (
        <div key={index} className="performant-list-item">
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}