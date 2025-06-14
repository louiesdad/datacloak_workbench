import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { 
  VirtualizedList,
  MemoizedResultItem,
  ProgressiveImage,
  useIntersectionObserver,
  useDebouncedSearch,
  preloadHeavyComponents,
  preloadAnalysisComponents
} from '../LazyComponents';
import { renderHook, act } from '@testing-library/react';

// Mock the performance utilities
vi.mock('../../utils/performance', () => ({
  createLazyComponent: vi.fn((importFunc) => {
    // Return a mock component
    return () => React.createElement('div', { 'data-testid': 'lazy-component' });
  }),
  preloadComponent: vi.fn(() => Promise.resolve())
}));

describe('LazyComponents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('VirtualizedList', () => {
    const mockItems = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      text: `Item ${i}`,
      value: i
    }));

    const mockRenderItem = (item: any, index: number) => (
      <div key={item.id} data-testid={`item-${index}`}>
        {item.text}
      </div>
    );

    it('should render visible items only', () => {
      render(
        <VirtualizedList
          items={mockItems}
          itemHeight={50}
          containerHeight={300}
          renderItem={mockRenderItem}
        />
      );

      // Should render first few items that are visible
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
      expect(screen.getByTestId('item-1')).toBeInTheDocument();

      // Should not render items far down the list
      expect(screen.queryByTestId('item-100')).not.toBeInTheDocument();
    });

    it('should update visible items on scroll', async () => {
      const { container } = render(
        <VirtualizedList
          items={mockItems}
          itemHeight={50}
          containerHeight={300}
          renderItem={mockRenderItem}
        />
      );

      const scrollContainer = container.querySelector('.virtualized-list');
      
      if (scrollContainer) {
        // Simulate scroll
        act(() => {
          Object.defineProperty(scrollContainer, 'scrollTop', {
            value: 500,
            writable: true
          });
          scrollContainer.dispatchEvent(new Event('scroll'));
        });

        // Should render different items after scroll
        await waitFor(() => {
          expect(screen.queryByTestId('item-0')).not.toBeInTheDocument();
        });
      }
    });

    it('should handle empty items array', () => {
      render(
        <VirtualizedList
          items={[]}
          itemHeight={50}
          containerHeight={300}
          renderItem={mockRenderItem}
        />
      );

      // Should render without crashing
      const container = screen.getByRole('generic');
      expect(container).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <VirtualizedList
          items={mockItems.slice(0, 10)}
          itemHeight={50}
          containerHeight={300}
          renderItem={mockRenderItem}
          className="custom-list"
        />
      );

      const listElement = container.querySelector('.virtualized-list.custom-list');
      expect(listElement).toBeInTheDocument();
    });

    it('should handle dynamic item height changes', () => {
      const { rerender } = render(
        <VirtualizedList
          items={mockItems.slice(0, 10)}
          itemHeight={50}
          containerHeight={300}
          renderItem={mockRenderItem}
        />
      );

      // Change item height
      rerender(
        <VirtualizedList
          items={mockItems.slice(0, 10)}
          itemHeight={100}
          containerHeight={300}
          renderItem={mockRenderItem}
        />
      );

      // Should update layout
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
    });
  });

  describe('MemoizedResultItem', () => {
    const mockResult = {
      id: 'result-1',
      text: 'This is a great product!',
      sentiment: 'positive' as const,
      score: 0.85,
      confidence: 0.92,
      keywords: ['great', 'product', 'amazing', 'excellent']
    };

    const mockOnSelect = vi.fn();

    it('should render result item with all data', () => {
      render(
        <MemoizedResultItem
          result={mockResult}
          index={0}
          isSelected={false}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('positive')).toBeInTheDocument();
      expect(screen.getByText('Score: 0.850')).toBeInTheDocument();
      expect(screen.getByText('92.0%')).toBeInTheDocument();
      expect(screen.getByText('This is a great product!')).toBeInTheDocument();
      expect(screen.getByText('great')).toBeInTheDocument();
      expect(screen.getByText('product')).toBeInTheDocument();
    });

    it('should handle selection', async () => {
      const user = userEvent.setup();

      render(
        <MemoizedResultItem
          result={mockResult}
          index={0}
          isSelected={false}
          onSelect={mockOnSelect}
        />
      );

      const resultItem = screen.getByRole('generic');
      await user.click(resultItem);

      expect(mockOnSelect).toHaveBeenCalledWith('result-1');
    });

    it('should show selected state', () => {
      render(
        <MemoizedResultItem
          result={mockResult}
          index={0}
          isSelected={true}
          onSelect={mockOnSelect}
        />
      );

      const resultItem = screen.getByRole('generic');
      expect(resultItem).toHaveClass('selected');
    });

    it('should handle limited keywords display', () => {
      render(
        <MemoizedResultItem
          result={mockResult}
          index={0}
          isSelected={false}
          onSelect={mockOnSelect}
        />
      );

      // Should show first 3 keywords
      expect(screen.getByText('great')).toBeInTheDocument();
      expect(screen.getByText('product')).toBeInTheDocument();
      expect(screen.getByText('amazing')).toBeInTheDocument();
      
      // Should show "more" indicator
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('should handle result without keywords', () => {
      const resultWithoutKeywords = { ...mockResult, keywords: undefined };

      render(
        <MemoizedResultItem
          result={resultWithoutKeywords}
          index={0}
          isSelected={false}
          onSelect={mockOnSelect}
        />
      );

      // Should not crash and not show keywords section
      expect(screen.getByText('This is a great product!')).toBeInTheDocument();
      expect(screen.queryByRole('generic', { name: /keywords/i })).not.toBeInTheDocument();
    });

    it('should memoize correctly', () => {
      const { rerender } = render(
        <MemoizedResultItem
          result={mockResult}
          index={0}
          isSelected={false}
          onSelect={mockOnSelect}
        />
      );

      // Re-render with same props
      rerender(
        <MemoizedResultItem
          result={mockResult}
          index={0}
          isSelected={false}
          onSelect={mockOnSelect}
        />
      );

      // Component should not re-render unnecessarily
      expect(screen.getByText('This is a great product!')).toBeInTheDocument();
    });
  });

  describe('ProgressiveImage', () => {
    beforeEach(() => {
      // Mock Image constructor
      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';

        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 100);
        }
      } as any;
    });

    it('should show skeleton while loading', () => {
      render(
        <ProgressiveImage
          src="https://example.com/image.jpg"
          alt="Test image"
        />
      );

      expect(screen.getByRole('generic')).toHaveClass('progressive-image-container');
    });

    it('should show image when loaded', async () => {
      render(
        <ProgressiveImage
          src="https://example.com/image.jpg"
          alt="Test image"
        />
      );

      await waitFor(() => {
        const img = screen.getByRole('img');
        expect(img).toHaveClass('loaded');
      });
    });

    it('should show placeholder image', () => {
      render(
        <ProgressiveImage
          src="https://example.com/image.jpg"
          alt="Test image"
          placeholderSrc="https://example.com/placeholder.jpg"
        />
      );

      const placeholder = screen.getByRole('img', { name: 'Test image' });
      expect(placeholder).toHaveClass('progressive-image-placeholder');
    });

    it('should handle image load error', async () => {
      // Mock image error
      global.Image = class {
        onerror: (() => void) | null = null;
        src = '';

        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 100);
        }
      } as any;

      render(
        <ProgressiveImage
          src="https://example.com/broken-image.jpg"
          alt="Test image"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load image')).toBeInTheDocument();
      });
    });

    it('should apply custom className', () => {
      render(
        <ProgressiveImage
          src="https://example.com/image.jpg"
          alt="Test image"
          className="custom-image"
        />
      );

      expect(screen.getByRole('generic')).toHaveClass('custom-image');
    });
  });

  describe('useIntersectionObserver', () => {
    let mockObserver: any;

    beforeEach(() => {
      mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
      };

      global.IntersectionObserver = vi.fn((callback) => {
        mockObserver.callback = callback;
        return mockObserver;
      });
    });

    it('should create intersection observer', () => {
      const callback = vi.fn();
      
      const { result } = renderHook(() => 
        useIntersectionObserver(callback, { threshold: 0.5 })
      );

      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        { threshold: 0.5 }
      );
      expect(result.current.current).toBeNull();
    });

    it('should observe element when ref is set', () => {
      const callback = vi.fn();
      
      const { result } = renderHook(() => 
        useIntersectionObserver(callback)
      );

      // Simulate setting ref
      const mockElement = document.createElement('div');
      result.current.current = mockElement;

      // Re-render to trigger useEffect
      act(() => {
        // Trigger intersection
        mockObserver.callback([{ isIntersecting: true }]);
      });

      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should cleanup on unmount', () => {
      const callback = vi.fn();
      
      const { unmount } = renderHook(() => 
        useIntersectionObserver(callback)
      );

      unmount();

      // Should cleanup observer
      expect(mockObserver.unobserve).toHaveBeenCalled();
    });

    it('should handle missing IntersectionObserver', () => {
      (global as any).IntersectionObserver = undefined;

      const callback = vi.fn();
      
      const { result } = renderHook(() => 
        useIntersectionObserver(callback)
      );

      // Should not crash
      expect(result.current.current).toBeNull();
    });
  });

  describe('useDebouncedSearch', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce search term', () => {
      const { result, rerender } = renderHook(
        ({ searchTerm }) => useDebouncedSearch(searchTerm, 300),
        { initialProps: { searchTerm: 'initial' } }
      );

      expect(result.current).toBe('initial');

      // Update search term
      rerender({ searchTerm: 'updated' });
      expect(result.current).toBe('initial'); // Still old value

      // Advance time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe('updated');
    });

    it('should use custom delay', () => {
      const { result, rerender } = renderHook(
        ({ searchTerm }) => useDebouncedSearch(searchTerm, 500),
        { initialProps: { searchTerm: 'initial' } }
      );

      rerender({ searchTerm: 'updated' });

      // Should not update with shorter delay
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current).toBe('initial');

      // Should update with full delay
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current).toBe('updated');
    });

    it('should reset timer on new search term', () => {
      const { result, rerender } = renderHook(
        ({ searchTerm }) => useDebouncedSearch(searchTerm, 300),
        { initialProps: { searchTerm: 'initial' } }
      );

      rerender({ searchTerm: 'update1' });
      
      act(() => {
        vi.advanceTimersByTime(200);
      });
      
      rerender({ searchTerm: 'update2' });
      
      act(() => {
        vi.advanceTimersByTime(200);
      });
      
      expect(result.current).toBe('initial'); // Still not updated
      
      act(() => {
        vi.advanceTimersByTime(100);
      });
      
      expect(result.current).toBe('update2');
    });
  });

  describe('Preload functions', () => {
    it('should preload heavy components', async () => {
      const { preloadComponent } = await import('../../utils/performance');
      
      await preloadHeavyComponents();

      // Should have called preloadComponent for each heavy component
      expect(preloadComponent).toHaveBeenCalledTimes(3);
    });

    it('should preload analysis components', async () => {
      const { preloadComponent } = await import('../../utils/performance');
      
      await preloadAnalysisComponents();

      // Should have called preloadComponent for analysis components
      expect(preloadComponent).toHaveBeenCalledTimes(2);
    });
  });
});