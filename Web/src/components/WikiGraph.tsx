import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WikiItem } from '../types';
import { parseRelations } from '../utils/textUtils';
import { ZoomIn, ZoomOut, RefreshCw, Eye, Sparkles, Filter, Layers } from 'lucide-react';
import { playSound } from '../utils/soundEffects';

interface Node {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  worldId: string;
  item: WikiItem;
}

interface Link {
  source: string;
  target: string;
  label: string;
}

interface WikiGraphProps {
  items: WikiItem[];
  wikiData: WikiItem[];
  searchQuery: string;
  selectedWorld: string;
  onOpenModal: (id: string) => void;
}

export const WikiGraph: React.FC<WikiGraphProps> = ({
  items,
  wikiData,
  searchQuery,
  selectedWorld,
  onOpenModal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<Node | null>(null);

  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Get color for category
  const getNodeColor = (tipo: string) => {
    const t = (tipo || 'entidad').toLowerCase();
    switch (t) {
      case 'mundo': return '#22d3ee'; // cyan
      case 'npc':
      case 'pc':
      case 'personaje': return '#34d399'; // emerald
      case 'lugar': return '#60a5fa'; // blue
      case 'objeto': return '#fbbf24'; // amber
      case 'faccion': return '#c084fc'; // purple
      case 'trama': return '#fb7185'; // rose
      default: return '#94a3b8'; // slate
    }
  };

  // Spread out nodes evenly in an expanded layout
  const spreadNodes = useCallback(() => {
    const width = containerRef.current?.clientWidth || 900;
    const height = containerRef.current?.clientHeight || 600;
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;
    
    // Calculate radius according to node count so they have plenty of room
    const baseRadius = Math.max(220, Math.min(width, height) * 0.35);

    nodes.forEach((node, idx) => {
      // Golden angle distribution for optimal spatial spreading
      const phi = idx * 137.5 * (Math.PI / 180);
      const r = baseRadius * Math.sqrt((idx + 1) / nodes.length);

      node.x = centerX + Math.cos(phi) * r * 1.4;
      node.y = centerY + Math.sin(phi) * r * 1.4;
      node.vx = 0;
      node.vy = 0;
    });

    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // Build graph nodes & links whenever items change
  useEffect(() => {
    const visibleItems = items.filter((item) => {
      if (selectedWorld !== 'all' && item.mundo_id !== selectedWorld) return false;
      return true;
    });

    const itemMap = new Map(visibleItems.map((i) => [i.id, i]));

    const width = containerRef.current?.clientWidth || 900;
    const height = containerRef.current?.clientHeight || 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.max(220, Math.min(width, height) * 0.35);

    // Initialize nodes with good spatial separation
    const newNodes: Node[] = visibleItems.map((item, idx) => {
      const phi = idx * 137.5 * (Math.PI / 180);
      const r = baseRadius * Math.sqrt((idx + 1) / (visibleItems.length || 1));
      const isWorld = item.tipo === 'mundo';
      const isPlot = item.tipo === 'trama';

      return {
        id: item.id,
        name: item.nombre || item.id,
        type: item.tipo || 'entidad',
        x: centerX + Math.cos(phi) * r * 1.3 + (Math.random() - 0.5) * 40,
        y: centerY + Math.sin(phi) * r * 1.3 + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: isWorld ? 20 : isPlot ? 16 : 12,
        color: getNodeColor(item.tipo),
        worldId: item.mundo_id,
        item,
      };
    });

    // Initialize links
    const newLinks: Link[] = [];
    visibleItems.forEach((item) => {
      const relations = parseRelations(item, wikiData);
      relations.forEach((rel) => {
        if (itemMap.has(rel.targetId)) {
          // Avoid duplicate reciprocal visual clutter if same direction exists
          const exists = newLinks.some(
            l => (l.source === item.id && l.target === rel.targetId) ||
                 (l.source === rel.targetId && l.target === item.id)
          );
          if (!exists) {
            newLinks.push({
              source: item.id,
              target: rel.targetId,
              label: rel.label,
            });
          }
        }
      });
    });

    nodesRef.current = newNodes;
    linksRef.current = newLinks;
    setSelectedNode(null);
    setHoveredNode(null);
  }, [items, selectedWorld, wikiData]);

  // Simulation & Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const resizeCanvas = () => {
      if (containerRef.current && canvas) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
      }
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    const render = () => {
      if (!running || !ctx || !canvas) return;

      const width = canvas.width;
      const height = canvas.height;

      // Physics simulation step
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // 1. Strong Repulsion between nodes (Coulomb-like force)
      const repulsionConstant = 16000;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          let dx = n2.x - n1.x;
          let dy = n2.y - n1.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist === 0) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
            dist = 1;
          }

          const minDist = n1.radius + n2.radius + 90;
          // Force is strongest when nodes are close, smoothly fading out
          const force = Math.min(repulsionConstant / (dist * dist + 1200), 12);
          
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (n1 !== draggedNode) {
            n1.vx -= fx;
            n1.vy -= fy;
          }
          if (n2 !== draggedNode) {
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }

      // 2. Gentle Spring Attraction along links
      links.forEach((link) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const desiredDist = 180;
          const force = (dist - desiredDist) * 0.0025;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (source !== draggedNode) {
            source.vx += fx;
            source.vy += fy;
          }
          if (target !== draggedNode) {
            target.vx -= fx;
            target.vy -= fy;
          }
        }
      });

      // 3. Soft center gravity & damping
      const cx = width / 2;
      const cy = height / 2;
      nodes.forEach((n) => {
        if (n === draggedNode) return;

        // Very light pull to center to keep graph bounded
        n.vx += (cx - n.x) * 0.00012;
        n.vy += (cy - n.y) * 0.00012;

        n.vx *= 0.84;
        n.vy *= 0.84;

        n.x += n.vx;
        n.y += n.vy;
      });

      // Draw Phase
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Search match set
      const isSearchActive = searchQuery.trim().length > 0;
      const searchMatchSet = new Set(
        isSearchActive
          ? nodes
              .filter(
                (n) =>
                  n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  n.type.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((n) => n.id)
          : []
      );

      // Determine active focus (hovered or selected node)
      const focusNode = hoveredNode || selectedNode;
      const connectedNodeIds = new Set<string>();
      if (focusNode) {
        connectedNodeIds.add(focusNode.id);
        links.forEach((l) => {
          if (l.source === focusNode.id) connectedNodeIds.add(l.target);
          if (l.target === focusNode.id) connectedNodeIds.add(l.source);
        });
      }

      // Draw Links
      links.forEach((link) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) return;

        const isFocusLink = focusNode && (focusNode.id === source.id || focusNode.id === target.id);
        const isDimmed =
          (focusNode && !isFocusLink) ||
          (isSearchActive && !searchMatchSet.has(source.id) && !searchMatchSet.has(target.id));

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (isFocusLink) {
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2.5;
        } else if (isDimmed) {
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.1)';
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
          ctx.lineWidth = 1.2;
        }
        ctx.stroke();

        // Draw relationship label if link is in focus
        if (isFocusLink && link.label) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          ctx.font = '10px Inter, sans-serif';
          const textWidth = ctx.measureText(link.label).width;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(midX - textWidth / 2 - 4, midY - 7, textWidth + 8, 14, 4);
          ctx.fill();

          ctx.fillStyle = '#e2e8f0';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(link.label, midX, midY);
        }
      });

      // Draw Nodes
      nodes.forEach((node) => {
        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;
        const isConnectedToFocus = focusNode ? connectedNodeIds.has(node.id) : true;
        const isMatch = isSearchActive && searchMatchSet.has(node.id);
        const isDimmed = (focusNode && !isConnectedToFocus) || (isSearchActive && !isMatch);

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.2 : 1;

        // Glow ring for focus/hover/match
        if (isSelected || isHovered || isMatch) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = isSelected
            ? 'rgba(168, 85, 247, 0.35)'
            : isHovered
            ? 'rgba(52, 211, 153, 0.35)'
            : 'rgba(34, 211, 238, 0.35)';
          ctx.fill();
        }

        // Main Node Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isSelected || isHovered ? 16 : 6;
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#090d16';
        ctx.stroke();

        // Inner Circle Accent
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();

        // Node Label Rendering
        const shouldShowFullLabel = isSelected || isHovered || (focusNode && isConnectedToFocus);
        const displayName = shouldShowFullLabel
          ? node.name
          : node.name.length > 15
          ? node.name.slice(0, 13) + '...'
          : node.name;

        ctx.shadowBlur = 0;
        ctx.font = shouldShowFullLabel ? 'bold 12px Inter, sans-serif' : '11px Inter, sans-serif';

        const labelY = node.y + node.radius + 14;
        const textWidth = ctx.measureText(displayName).width;

        // Background pill behind label for legibility
        ctx.fillStyle = shouldShowFullLabel ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.75)';
        ctx.beginPath();
        ctx.roundRect(node.x - textWidth / 2 - 6, labelY - 10, textWidth + 12, 18, 6);
        ctx.fill();
        ctx.strokeStyle = shouldShowFullLabel ? 'rgba(99, 102, 241, 0.5)' : 'rgba(51, 65, 85, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label Text
        ctx.fillStyle = shouldShowFullLabel ? '#ffffff' : '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayName, node.x, labelY);

        ctx.restore();
      });

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
    };
  }, [pan, zoom, selectedNode, hoveredNode, searchQuery, draggedNode]);

  // Convert Mouse Canvas Event to World Coordinates
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    return {
      x: (mouseX - pan.x) / zoom,
      y: (mouseY - pan.y) / zoom,
    };
  };

  const findNodeAtCoords = (coords: { x: number; y: number }) => {
    return nodesRef.current.find((n) => {
      const dx = n.x - coords.x;
      const dy = n.y - coords.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 8;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const clickedNode = findNodeAtCoords(coords);

    if (clickedNode) {
      setDraggedNode(clickedNode);
      setSelectedNode(clickedNode);
      playSound('click');
    } else {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (draggedNode) {
      draggedNode.x = coords.x;
      draggedNode.y = coords.y;
      draggedNode.vx = 0;
      draggedNode.vy = 0;
    } else if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else {
      const hoverCandidate = findNodeAtCoords(coords);
      setHoveredNode(hoverCandidate || null);
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsDraggingCanvas(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.35), 2.8));
  };

  const resetView = () => {
    spreadNodes();
    setSelectedNode(null);
    setHoveredNode(null);
    playSound('click');
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-180px)] min-h-[550px] bg-slate-950 rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl flex flex-col justify-between"
    >
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Control Overlay Buttons */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.2, 2.8))}
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
          title="Acercar"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.8, 0.35))}
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
          title="Alejar"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 px-2.5 text-xs font-semibold"
          title="Reorganizar nodos y vista"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Reorganizar</span>
        </button>
      </div>

      {/* Legend Overlay */}
      <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-xs shadow-xl">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span><span className="text-slate-400">Mundo</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span><span className="text-slate-400">Personaje</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span><span className="text-slate-400">Lugar</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span><span className="text-slate-400">Objeto</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span><span className="text-slate-400">Facci&oacute;n</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span><span className="text-slate-400">Trama</span></div>
      </div>

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`w-full h-full ${
          draggedNode
            ? 'cursor-grabbing'
            : hoveredNode
            ? 'cursor-pointer'
            : isDraggingCanvas
            ? 'cursor-grabbing'
            : 'cursor-grab'
        }`}
      />

      {/* Selected Node Details Drawer Bar at Bottom */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 z-20 bg-slate-900/95 border border-indigo-500/40 backdrop-blur-xl p-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full shrink-0 shadow-lg"
              style={{ backgroundColor: selectedNode.color }}
            />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">{selectedNode.name}</h4>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedNode.type}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                {selectedNode.item.contenido_lore?.replace(/#+\s*/g, '') || 'Sin contenido de lore.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => {
                onOpenModal(selectedNode.id);
                playSound('modal');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Ver Ficha Completa</span>
            </button>
            <button
              onClick={() => setSelectedNode(null)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-medium transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

