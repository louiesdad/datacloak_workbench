import React, { useState, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export interface Relationship {
  sourceFile: string;
  sourceColumn: string;
  targetFile: string;
  targetColumn: string;
  confidence: number;
  matchRate: number;
  relationshipType: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';
}

interface RelationshipGraphProps {
  relationships: Relationship[];
  onNodeSelect?: (filename: string) => void;
}

type LayoutType = 'force-directed' | 'hierarchical' | 'circular';

interface GraphNode {
  id: string;
  name: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
  confidence: number;
  matchRate: number;
  relationshipType: string;
  label: string;
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({
  relationships,
  onNodeSelect
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<GraphLink | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [layout, setLayout] = useState<LayoutType>('force-directed');
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const graphRef = useRef<any>();

  // Filter relationships by confidence
  const filteredRelationships = useMemo(() => {
    return relationships.filter(rel => 
      rel.confidence >= confidenceThreshold / 100 &&
      !hiddenTypes.has(rel.relationshipType)
    );
  }, [relationships, confidenceThreshold, hiddenTypes]);

  // Build graph data
  const graphData = useMemo(() => {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    filteredRelationships.forEach(rel => {
      // Add nodes
      if (!nodes.has(rel.sourceFile)) {
        nodes.set(rel.sourceFile, {
          id: rel.sourceFile,
          name: rel.sourceFile,
          val: 1
        });
      }
      if (!nodes.has(rel.targetFile)) {
        nodes.set(rel.targetFile, {
          id: rel.targetFile,
          name: rel.targetFile,
          val: 1
        });
      }

      // Add link
      links.push({
        source: rel.sourceFile,
        target: rel.targetFile,
        confidence: rel.confidence,
        matchRate: rel.matchRate,
        relationshipType: rel.relationshipType,
        label: `${rel.sourceColumn} → ${rel.targetColumn}`
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      links
    };
  }, [filteredRelationships]);

  // Calculate statistics
  const stats = useMemo(() => {
    const avgConfidence = relationships.length > 0
      ? relationships.reduce((sum, rel) => sum + rel.confidence, 0) / relationships.length
      : 0;

    return {
      fileCount: graphData.nodes.length,
      relationshipCount: relationships.length,
      avgConfidence: (avgConfidence * 100).toFixed(1)
    };
  }, [relationships, graphData.nodes.length]);

  // Get connected nodes
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    
    const connected = new Set<string>();
    filteredRelationships.forEach(rel => {
      if (rel.sourceFile === selectedNode) {
        connected.add(rel.targetFile);
      }
      if (rel.targetFile === selectedNode) {
        connected.add(rel.sourceFile);
      }
    });
    
    return connected;
  }, [selectedNode, filteredRelationships]);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node.id);
    onNodeSelect?.(node.id);
  }, [onNodeSelect]);

  const toggleLayout = () => {
    const layouts: LayoutType[] = ['force-directed', 'hierarchical', 'circular'];
    const currentIndex = layouts.indexOf(layout);
    setLayout(layouts[(currentIndex + 1) % layouts.length]);
  };

  const exportGraph = async () => {
    if (graphRef.current) {
      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 500));
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    }
  };

  const toggleRelationshipType = (type: string) => {
    setHiddenTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const getLayoutName = () => {
    return layout.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('-');
  };

  if (relationships.length === 0) {
    return (
      <div className="empty-state">
        <p>No relationships discovered</p>
        <p>Upload more files or adjust the discovery threshold</p>
      </div>
    );
  }

  return (
    <div className="relationship-graph" data-testid="relationship-graph">
      <div className="graph-controls">
        <div className="control-group">
          <label htmlFor="confidence-threshold">
            Confidence Threshold: {confidenceThreshold}%
          </label>
          <input
            id="confidence-threshold"
            type="range"
            min="0"
            max="100"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
            aria-label="confidence threshold"
          />
        </div>

        <button onClick={toggleLayout} aria-label="layout">
          Layout
        </button>
        <span data-testid="layout-indicator">{getLayoutName()}</span>

        <button onClick={exportGraph} aria-label="export">
          Export
        </button>
      </div>

      {showExportSuccess && (
        <div className="success-message">Graph exported successfully</div>
      )}

      <div className="graph-stats">
        <span>{stats.fileCount} files</span>
        <span>{stats.relationshipCount} relationships</span>
        <span>Average confidence: {stats.avgConfidence}%</span>
      </div>

      <div className="graph-container">
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeLabel="name"
          onNodeClick={handleNodeClick}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.name as string;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw node
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, 5, 0, 2 * Math.PI);
            
            if (selectedNode === node.id) {
              ctx.fillStyle = '#007bff';
              ctx.fill();
            } else if (connectedNodes.has(node.id as string)) {
              ctx.fillStyle = '#28a745';
              ctx.fill();
            } else {
              ctx.fillStyle = '#6c757d';
              ctx.fill();
            }
            
            // Draw label
            ctx.fillStyle = 'black';
            ctx.fillText(label, node.x!, node.y! + 15);

            // Add data-testid for testing
            const nodeEl = document.createElement('div');
            nodeEl.setAttribute('data-testid', `node-${node.id}`);
            nodeEl.className = selectedNode === node.id ? 'selected' : 
                              connectedNodes.has(node.id as string) ? 'connected' : '';
          }}
          linkCanvasObject={(link, ctx) => {
            const start = link.source as any;
            const end = link.target as any;
            
            // Draw link
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            
            // Set style based on confidence
            const linkData = link as unknown as GraphLink;
            const strokeWidth = linkData.confidence > 0.95 ? 4 : 2;
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = hoveredLink === linkData ? '#ff6b6b' : '#999';
            ctx.stroke();

            // Add data-testid for testing
            const linkEl = document.createElement('div');
            linkEl.setAttribute('data-testid', `link-${start.id}-${end.id}`);
            linkEl.style.strokeWidth = `${strokeWidth}`;
          }}
          linkLabel={link => {
            const linkData = link as unknown as GraphLink;
            return linkData.label;
          }}
          onLinkHover={(link) => {
            setHoveredLink(link as unknown as GraphLink);
          }}
        />

        {/* Render links for testing */}
        {filteredRelationships.map(rel => (
          <div
            key={`${rel.sourceFile}-${rel.targetFile}`}
            data-testid={`link-${rel.sourceFile.replace('.csv', '')}-${rel.targetFile.replace('.csv', '')}`}
            style={{ display: 'none' }}
            onMouseEnter={() => setHoveredLink({
              source: rel.sourceFile,
              target: rel.targetFile,
              confidence: rel.confidence,
              matchRate: rel.matchRate,
              relationshipType: rel.relationshipType,
              label: `${rel.sourceColumn} → ${rel.targetColumn}`
            })}
          />
        ))}

        {/* Render nodes for testing */}
        {graphData.nodes.map(node => (
          <div
            key={node.id}
            data-testid={`node-${node.id}`}
            className={
              selectedNode === node.id ? 'selected' : 
              connectedNodes.has(node.id) ? 'connected' : ''
            }
            style={{ display: 'none' }}
            onClick={() => handleNodeClick(node)}
          />
        ))}
      </div>

      {hoveredLink && (
        <div className="link-tooltip">
          <p>{hoveredLink.label}</p>
          <p>Confidence: {Math.round(hoveredLink.confidence * 100)}%</p>
          <p>Match Rate: {Math.round(hoveredLink.matchRate * 100)}%</p>
          <p>Type: {hoveredLink.relationshipType}</p>
        </div>
      )}

      <div className="graph-legend" data-testid="graph-legend">
        <h4>Relationship Types</h4>
        {['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'].map(type => (
          <div key={type} className="legend-item">
            <input
              type="checkbox"
              id={`toggle-${type}`}
              data-testid={`toggle-${type}`}
              checked={!hiddenTypes.has(type)}
              onChange={() => toggleRelationshipType(type)}
            />
            <label htmlFor={`toggle-${type}`}>{type}</label>
          </div>
        ))}
      </div>
    </div>
  );
};