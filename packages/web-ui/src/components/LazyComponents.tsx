import React, { Suspense } from 'react';
import { createLazyComponent, preloadComponent } from '../utils/performance';
import './LazyComponents.css';

// Loading fallback component
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="lazy-loading-container">
    <div className="lazy-loading-spinner"></div>
    <p className="lazy-loading-message">{message}</p>
  </div>
);

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <div className="lazy-error-container">
    <div className="lazy-error-icon">⚠️</div>
    <h3>Failed to load component</h3>
    <p>{error.message}</p>
    <button onClick={retry} className="lazy-retry-button">
      Try Again
    </button>
  </div>
);

// HOC for lazy loading with error boundary
const withLazyLoading = <P extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>,
  loadingMessage?: string
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const [error, setError] = React.useState<Error | null>(null);
    const [retryKey, setRetryKey] = React.useState(0);

    const retry = () => {
      setError(null);
      setRetryKey(prev => prev + 1);
    };

    if (error) {
      return <ErrorFallback error={error} retry={retry} />;
    }

    return (
      <Suspense fallback={<LoadingFallback message={loadingMessage} />}>
        <React.ErrorBoundary
          fallback={<ErrorFallback error={new Error('Component failed to render')} retry={retry} />}
          onError={setError}
        >
          <LazyComponent key={retryKey} {...props} ref={ref} />
        </React.ErrorBoundary>
      </Suspense>
    );
  });
};

// Lazy-loaded components
export const LazyTransformDesigner = createLazyComponent(
  () => import('./TransformDesigner').then(module => ({ default: module.TransformDesigner })),
);

export const LazyTransformOperationEditor = createLazyComponent(
  () => import('./TransformOperationEditor').then(module => ({ default: module.TransformOperationEditor })),
);

export const LazyTransformPreviewPanel = createLazyComponent(
  () => import('./TransformPreviewPanel').then(module => ({ default: module.TransformPreviewPanel })),
);

export const LazyRunWizard = createLazyComponent(
  () => import('./RunWizard').then(module => ({ default: module.RunWizard })),
);

export const LazyResultExplorer = createLazyComponent(
  () => import('./ResultExplorer').then(module => ({ default: module.ResultExplorer })),
);

// Wrapped components with loading states
export const TransformDesigner = withLazyLoading(
  LazyTransformDesigner,
  'Loading Transform Designer...'
);

export const TransformOperationEditor = withLazyLoading(
  LazyTransformOperationEditor,
  'Loading Operation Editor...'
);

export const TransformPreviewPanel = withLazyLoading(
  LazyTransformPreviewPanel,
  'Loading Preview Panel...'
);

export const RunWizard = withLazyLoading(
  LazyRunWizard,
  'Loading Analysis Wizard...'
);

export const ResultExplorer = withLazyLoading(
  LazyResultExplorer,
  'Loading Results Explorer...'
);

// Preload heavy components on user interaction
export const preloadHeavyComponents = () => {
  // Preload transform components when user starts working with data
  preloadComponent(() => import('./TransformDesigner'));
  preloadComponent(() => import('./TransformOperationEditor'));
  preloadComponent(() => import('./TransformPreviewPanel'));
};

export const preloadAnalysisComponents = () => {
  // Preload analysis components when user configures transforms
  preloadComponent(() => import('./RunWizard'));
  preloadComponent(() => import('./ResultExplorer'));
};

// Memory-optimized list component for large datasets
export const VirtualizedList: React.FC<{
  items: any[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  className?: string;
}> = ({ items, itemHeight, containerHeight, renderItem, className = '' }) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount, items.length);
  const visibleItems = items.slice(startIndex, endIndex);

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      className={`virtualized-list ${className}`}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
              className="virtualized-item"
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Memoized result item for performance
export const MemoizedResultItem = React.memo<{
  result: any;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}>(({ result, index, isSelected, onSelect }) => {
  const handleClick = React.useCallback(() => {
    onSelect(result.id);
  }, [result.id, onSelect]);

  return (
    <div 
      className={`result-item ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      <div className="result-header">
        <span className={`sentiment-badge ${result.sentiment}`}>
          {result.sentiment}
        </span>
        <span className="result-score">
          Score: {result.score.toFixed(3)}
        </span>
        <span className="result-confidence">
          {(result.confidence * 100).toFixed(1)}%
        </span>
      </div>
      <div className="result-text">
        {result.text}
      </div>
      {result.keywords && result.keywords.length > 0 && (
        <div className="result-keywords">
          {result.keywords.slice(0, 3).map((keyword: string) => (
            <span key={keyword} className="keyword-tag">{keyword}</span>
          ))}
          {result.keywords.length > 3 && (
            <span className="keyword-more">+{result.keywords.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  );
});

MemoizedResultItem.displayName = 'MemoizedResultItem';

// Progressive image loader
export const ProgressiveImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  placeholderSrc?: string;
}> = ({ src, alt, className = '', placeholderSrc }) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setIsError(true);
    img.src = src;
  }, [src]);

  if (isError) {
    return (
      <div className={`progressive-image-error ${className}`}>
        <span>Failed to load image</span>
      </div>
    );
  }

  return (
    <div className={`progressive-image-container ${className}`}>
      {!isLoaded && placeholderSrc && (
        <img
          src={placeholderSrc}
          alt={alt}
          className="progressive-image-placeholder"
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`progressive-image ${isLoaded ? 'loaded' : 'loading'}`}
        style={{ display: isLoaded ? 'block' : 'none' }}
      />
      {!isLoaded && !placeholderSrc && (
        <div className="progressive-image-skeleton">
          <div className="skeleton-shimmer"></div>
        </div>
      )}
    </div>
  );
};

// Intersection observer hook for lazy loading
export const useIntersectionObserver = (
  callback: (isIntersecting: boolean) => void,
  options: IntersectionObserverInit = {}
) => {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => callback(entry.isIntersecting),
      options
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [callback, options]);

  return ref;
};

// Debounced search hook
export const useDebouncedSearch = (
  searchTerm: string,
  delay: number = 300
) => {
  const [debouncedTerm, setDebouncedTerm] = React.useState(searchTerm);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, delay]);

  return debouncedTerm;
};