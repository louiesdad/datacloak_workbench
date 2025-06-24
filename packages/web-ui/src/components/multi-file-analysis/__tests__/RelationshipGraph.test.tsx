import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RelationshipGraph } from '../RelationshipGraph';
import { vi } from 'vitest';

// Mock react-force-graph-2d
vi.mock('react-force-graph-2d', () => ({
  default: vi.fn(() => {
    // Mock component that simulates the graph
    return React.createElement('div', { 'data-testid': 'force-graph' }, 
      React.createElement('div', { 'data-testid': 'mock-graph-canvas' }, 'Graph Canvas')
    );
  })
}));

describe('RelationshipGraph', () => {
  const mockRelationships = [
    {
      sourceFile: 'customers.csv',
      sourceColumn: 'customer_id',
      targetFile: 'orders.csv',
      targetColumn: 'customer_id',
      confidence: 0.95,
      matchRate: 0.98,
      relationshipType: 'ONE_TO_MANY' as const
    },
    {
      sourceFile: 'orders.csv',
      sourceColumn: 'product_id',
      targetFile: 'products.csv',
      targetColumn: 'id',
      confidence: 0.99,
      matchRate: 1.0,
      relationshipType: 'MANY_TO_ONE' as const
    },
    {
      sourceFile: 'customers.csv',
      sourceColumn: 'email',
      targetFile: 'feedback.csv',
      targetColumn: 'user_email',
      confidence: 0.87,
      matchRate: 0.75,
      relationshipType: 'ONE_TO_MANY' as const
    }
  ];

  // RED TEST 1: Display relationship graph
  test('should display relationship graph with nodes and links', () => {
    render(<RelationshipGraph relationships={mockRelationships} />);
    
    expect(screen.getByTestId('force-graph')).toBeInTheDocument();
    expect(screen.getByTestId('relationship-graph')).toBeInTheDocument();
  });

  // RED TEST 2: Show relationship details on hover
  test('should show relationship details on hover', async () => {
    render(<RelationshipGraph relationships={mockRelationships} />);
    
    // Find and hover over a relationship link
    const relationshipLink = screen.getByTestId('link-customers-orders');
    fireEvent.mouseEnter(relationshipLink);
    
    await waitFor(() => {
      expect(screen.getByText('customer_id → customer_id')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 95%')).toBeInTheDocument();
      expect(screen.getByText('Match Rate: 98%')).toBeInTheDocument();
      expect(screen.getByText('Type: ONE_TO_MANY')).toBeInTheDocument();
    });
  });

  // RED TEST 3: Filter relationships by confidence
  test('should filter relationships by confidence threshold', () => {
    render(<RelationshipGraph relationships={mockRelationships} />);
    
    const confidenceSlider = screen.getByRole('slider', { name: /confidence threshold/i });
    
    // Set threshold to 0.9 (90%)
    fireEvent.change(confidenceSlider, { target: { value: '90' } });
    
    // Should hide the customer-feedback relationship (87% confidence)
    expect(screen.queryByTestId('link-customers-feedback')).not.toBeInTheDocument();
    expect(screen.getByTestId('link-customers-orders')).toBeInTheDocument();
    expect(screen.getByTestId('link-orders-products')).toBeInTheDocument();
  });

  // RED TEST 4: Highlight connected nodes on selection
  test('should highlight connected nodes when a node is selected', () => {
    const onNodeSelect = vi.fn();
    render(
      <RelationshipGraph 
        relationships={mockRelationships}
        onNodeSelect={onNodeSelect}
      />
    );
    
    const customersNode = screen.getByTestId('node-customers.csv');
    fireEvent.click(customersNode);
    
    expect(customersNode).toHaveClass('selected');
    expect(screen.getByTestId('node-orders.csv')).toHaveClass('connected');
    expect(screen.getByTestId('node-feedback.csv')).toHaveClass('connected');
    expect(screen.getByTestId('node-products.csv')).not.toHaveClass('connected');
    
    expect(onNodeSelect).toHaveBeenCalledWith('customers.csv');
  });

  // RED TEST 5: Display graph statistics
  test('should display graph statistics', () => {
    render(<RelationshipGraph relationships={mockRelationships} />);
    
    expect(screen.getByText('4 files')).toBeInTheDocument();
    expect(screen.getByText('3 relationships')).toBeInTheDocument();
    expect(screen.getByText('Average confidence: 93.7%')).toBeInTheDocument();
  });

  // RED TEST 6: Empty state
  test('should display empty state when no relationships', () => {
    render(<RelationshipGraph relationships={[]} />);
    
    expect(screen.getByText('No relationships discovered')).toBeInTheDocument();
    expect(screen.getByText('Upload more files or adjust the discovery threshold')).toBeInTheDocument();
  });

  // RED TEST 7: Toggle graph layout
  test('should toggle between different graph layouts', () => {
    render(<RelationshipGraph relationships={mockRelationships} />);
    
    const layoutButton = screen.getByRole('button', { name: /layout/i });
    
    // Default should be force-directed
    expect(screen.getByTestId('layout-indicator')).toHaveTextContent('Force-Directed');
    
    // Click to change to hierarchical
    fireEvent.click(layoutButton);
    expect(screen.getByTestId('layout-indicator')).toHaveTextContent('Hierarchical');
    
    // Click again for circular
    fireEvent.click(layoutButton);
    expect(screen.getByTestId('layout-indicator')).toHaveTextContent('Circular');
  });

  // RED TEST 8: Export graph as image
  test('should export graph as image', async () => {
    const mockDownload = vi.fn();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    
    render(<RelationshipGraph relationships={mockRelationships} />);
    
    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(screen.getByText('Graph exported successfully')).toBeInTheDocument();
    });
  });

  // RED TEST 9: Show relationship strength visually
  test('should show relationship strength through visual indicators', () => {
    render(<RelationshipGraph relationships={mockRelationships} />);
    
    // Strong relationships should have thicker lines
    const strongLink = screen.getByTestId('link-orders-products');
    expect(strongLink).toHaveStyle({ strokeWidth: '4' });
    
    // Weak relationships should have thinner lines
    const weakLink = screen.getByTestId('link-customers-feedback');
    expect(weakLink).toHaveStyle({ strokeWidth: '2' });
  });

  // RED TEST 10: Interactive legend
  test('should display interactive legend', () => {
    render(<RelationshipGraph relationships={mockRelationships} />);
    
    const legend = screen.getByTestId('graph-legend');
    expect(legend).toBeInTheDocument();
    
    // Legend items
    expect(screen.getByText('ONE_TO_ONE')).toBeInTheDocument();
    expect(screen.getByText('ONE_TO_MANY')).toBeInTheDocument();
    expect(screen.getByText('MANY_TO_ONE')).toBeInTheDocument();
    
    // Click to toggle visibility
    const oneToManyToggle = screen.getByTestId('toggle-ONE_TO_MANY');
    fireEvent.click(oneToManyToggle);
    
    // Should hide ONE_TO_MANY relationships
    expect(screen.queryByTestId('link-customers-orders')).not.toBeInTheDocument();
    expect(screen.queryByTestId('link-customers-feedback')).not.toBeInTheDocument();
    expect(screen.getByTestId('link-orders-products')).toBeInTheDocument();
  });
});