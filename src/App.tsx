/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { Monitor, Trash2, Folder, HardDrive, Chrome, X, Minimize2, Square, Link, Info, User, Shield, Swords, Zap, Activity, Lock, Pencil } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// Custom Mouse Cursor SVG with Click Effect
const CustomCursorIcon = ({ color = 'white', isClicked = false, mode = 'pointer', chargeProgress = 0 }: { color?: string, isClicked?: boolean, mode?: string, chargeProgress?: number }) => {
  const getIcon = () => {
    switch(mode) {
      case 'pencil': return '/Pen_mouse.png';
      case 'eraser': return '/recycle-bin.png';
      case 'hammer': return 'https://img.icons8.com/pixel-serif/64/null/hammer.png';
      case 'spray': return 'https://img.icons8.com/pixel-serif/64/null/paint-spray.png';
      case 'bucket': return 'https://img.icons8.com/pixel-serif/64/null/paint-bucket.png';
      case 'stamp': return 'https://img.icons8.com/pixel-serif/64/null/stamp.png';
      default: return null;
    }
  };

  const iconSrc = getIcon();

  return (
    <div className="relative">
      {mode === 'pointer' ? (
        <div className="relative">
          <svg 
            width="32" 
            height="32" 
            viewBox="0 0 32 32" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg" 
            className={`${isClicked ? 'scale-90' : 'scale-100'} transition-transform`}
            style={{ shapeRendering: 'crispEdges' }}
          >
            <path d="M4 2V27L10.5 20.5L14 28L18 26L14.5 18.5L23 18L4 2Z" fill={color} stroke="black" strokeWidth="3" strokeLinejoin="miter" />
          </svg>
          {chargeProgress > 0 && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-black/40 border border-white/50 rounded-full overflow-hidden pointer-events-none">
              <div 
                className="h-full bg-blue-400 transition-all duration-100" 
                style={{ width: `${chargeProgress * 100}%` }}
              />
              {chargeProgress >= 1 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="absolute inset-0 bg-white"
                />
              )}
            </div>
          )}
          {chargeProgress >= 1 && (
            <motion.div 
              className="absolute -inset-4 border-2 border-cyan-400 rounded-full"
              animate={{ scale: [1, 2], opacity: [0.8, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          )}
        </div>
      ) : (
        <div 
          className={`${isClicked ? 'scale-90' : 'scale-100'} transition-transform p-0 flex items-center justify-center`}
        >
          <img 
            src={iconSrc || "/Pen_mouse.png"} 
            alt={mode} 
            className="w-10 h-10 object-contain pixelated drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]" 
            onError={(e) => { (e.target as any).src = "https://img.icons8.com/pixel-serif/64/null/pencil.png" }}
          />
        </div>
      )}
      {isClicked && (
        <motion.div 
          className="absolute inset-0 bg-white/40 ring-2 ring-white rounded-full pointer-events-none" 
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </div>
  );
};

interface PhysicsObject {
  id: string;
  points: {x: number, y: number}[];
  x: number;
  y: number;
  angle: number;
  color: string;
  creatorId: string;
  heldBy: string | null;
  throwsRemaining: number;
  createdAt: number;
  damage: number;
  type?: 'default' | 'hammer' | 'eraser' | 'spray' | 'bucket' | 'stamp';
}

interface UserState {
  x: number;
  y: number;
  username: string;
  health: number;
  isReady: boolean;
  cursorMode: 'pointer' | 'pencil' | 'eraser' | 'hammer' | 'spray' | 'bucket' | 'stamp';
}

interface PlayerRowProps {
  name: string;
  health: number;
  isReady: boolean;
  onReady?: () => void;
  isSelf: boolean;
}

function PlayerRow(props: PlayerRowProps) {
  const { name, health, isReady, onReady, isSelf } = props;
  const [displayHealth, setDisplayHealth] = useState(health);
  const [isHit, setIsHit] = useState(false);

  useEffect(() => {
    if (health < displayHealth) {
      setIsHit(true);
      const timer = setTimeout(() => {
        setDisplayHealth(health);
        setIsHit(false);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setDisplayHealth(health);
    }
  }, [health, displayHealth]);

  return (
    <div className="flex items-center gap-3 p-2 bg-white border border-gray-300 shadow-sm">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-tighter ${isSelf ? 'text-blue-600' : 'text-gray-700'}`}>{name}</span>
          <span className="text-[10px] font-mono leading-none">{health}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 border border-gray-400 relative overflow-hidden">
          {/* Ghost Health (Red) */}
          <motion.div 
            animate={{ width: `${displayHealth}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-0 left-0 h-full bg-red-600 opacity-50"
          />
          {/* Current Health (Green) */}
          <motion.div 
            animate={{ width: `${health}%` }}
            transition={{ duration: 0.1 }}
            className={`absolute top-0 left-0 h-full ${health > 50 ? 'bg-green-500' : health > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
          />
          {/* Flash Effect */}
          <AnimatePresence>
            {isHit && (
              <motion.div 
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white"
              />
            )}
          </AnimatePresence>
        </div>
      </div>
      {onReady ? (
        <button 
          onClick={onReady}
          className={`px-3 py-1 border-2 text-[9px] font-black uppercase transition-all ${
            isReady 
              ? 'bg-green-500 border-green-700 text-white' 
              : 'bg-gray-100 border-gray-400 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {isReady ? 'READY!' : 'READY?'}
        </button>
      ) : (
        <div className={`text-[9px] font-black uppercase px-2 py-1 border ${isReady ? 'text-green-600 bg-green-50 border-green-200' : 'text-gray-400 bg-gray-50 border-gray-200'}`}>
          {isReady ? 'READY' : '...'}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [uiMousePos, setUiMousePos] = useState({ x: 0, y: 0 });
  const [isClicked, setIsClicked] = useState(false);
  const [otherUsers, setOtherUsers] = useState<Record<string, UserState>>({});
  const [health, setHealth] = useState(100);
  const [cursorMode, setCursorMode] = useState<'pointer' | 'pencil'>('pointer');
  const cursorModeRef = useRef(cursorMode);
  useEffect(() => { cursorModeRef.current = cursorMode; }, [cursorMode]);

  const [winner, setWinner] = useState<{id: string, name: string} | null>(null);

  const [chargeProgress, setChargeProgress] = useState(0);
  const chargeStartTime = useRef<number | null>(null);
  const isCharged = useRef(false);
  const chargeLocation = useRef({ x: 0, y: 0 });

  const healthRef = useRef(health);
  useEffect(() => { healthRef.current = health; }, [health]);

  const [money, setMoney] = useState(0);
  const [unlockedModes, setUnlockedModes] = useState<string[]>(['pointer', 'pencil']);
  const [showModeSwitch, setShowModeSwitch] = useState(false);
  const [lastModeChange, setLastModeChange] = useState(0);
  const scrollAccumulator = useRef(0);
  const clickTimes = useRef<number[]>([]);
  const [isAutoclicker, setIsAutoclicker] = useState(false);

  const [physicsObjects, setPhysicsObjects] = useState<PhysicsObject[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<{x: number, y: number}[]>([]);
  const physicsEngine = useRef<any>(null);
  const physicsBodies = useRef<Record<string, any>>({});
  const lastPhysicsUpdate = useRef(0);
  const grabbedObjectId = useRef<string | null>(null);

  const physicsObjectsRef = useRef(physicsObjects);
  useEffect(() => { physicsObjectsRef.current = physicsObjects; }, [physicsObjects]);

  // Matter.js Initialization
  useEffect(() => {
    import('matter-js').then(Matter => {
      const engine = Matter.Engine.create();
      engine.gravity.y = 0.5; // Desktop gravity
      physicsEngine.current = engine;

      const runner = () => {
        if (!physicsEngine.current) return;
        Matter.Engine.update(physicsEngine.current, 16.67);
        
        // Sync bodies to state
        const updatedObjects: any[] = [];
        let needsStateUpdate = false;

        const now = Date.now();
        Object.entries(physicsBodies.current).forEach(([id, b]) => {
          const body = b as any;
          const obj = physicsObjectsRef.current.find(o => o.id === id);
          if (obj) {
            // Auto-cleanup: 6 seconds without being held
            if (obj.heldBy === null && now - obj.createdAt > 6000 && obj.creatorId === socketRef.current?.id) {
              socketRef.current?.emit('remove-physics-object', id);
              return;
            }

            // Update position and angle
            const newX = body.position.x;
            const newY = body.position.y;
            const newAngle = body.angle;

            if (Math.abs(obj.x - newX) > 0.1 || Math.abs(obj.y - newY) > 0.1 || Math.abs(obj.angle - newAngle) > 0.01) {
              needsStateUpdate = true;
            }
            
            // Check for collision with players if it's "thrown" (moving fast)
            const speed = Math.sqrt(body.velocity.x**2 + body.velocity.y**2);
            if (speed > 5 && obj.heldBy === null) {
              Object.entries(otherUsersRef.current).forEach(([uid, user]) => {
                const u = user as UserState;
                if (u.health <= 0) return; // Don't hit dead players
                const dist = Math.sqrt(Math.pow(body.position.x - u.x, 2) + Math.pow(body.position.y - u.y, 2));
                if (dist < 40) {
                  socketRef.current?.emit('damage-player', { targetId: uid, damage: obj.damage });
                  // Remove object after hit
                  socketRef.current?.emit('remove-physics-object', id);
                }
              });
              
              // Also check self
              if (healthRef.current > 0 && obj.creatorId !== socketRef.current?.id) {
                const dist = Math.sqrt(Math.pow(body.position.x - lastMousePos.current.x, 2) + Math.pow(body.position.y - lastMousePos.current.y, 2));
                if (dist < 40) {
                   socketRef.current?.emit('damage-player', { targetId: socketRef.current?.id || '', damage: obj.damage });
                   socketRef.current?.emit('remove-physics-object', id);
                }
              }
            }

            updatedObjects.push({ ...obj, x: newX, y: newY, angle: newAngle });
          }
        });

        if (updatedObjects.length !== physicsObjectsRef.current.length || needsStateUpdate) {
           setPhysicsObjects(updatedObjects);
        }

        requestAnimationFrame(runner);
      };

      const animationId = requestAnimationFrame(runner);
      return () => cancelAnimationFrame(animationId);
    });
  }, []);
  const [isReady, setIsReady] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const isGameActiveRef = useRef(isGameActive);
  useEffect(() => { isGameActiveRef.current = isGameActive; }, [isGameActive]);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [swipes, setSwipes] = useState<{id: string, attackerId: string, from: {x: number, y: number}, to: {x: number, y: number}, color?: string}[]>([]);
  const lastTrailPoint = useRef({ x: 0, y: 0 });
  const [damagePopups, setDamagePopups] = useState<{id: string, playerId: string, amount: number, x: number, y: number}[]>([]);
  
  const mouseVelocity = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const isSwiping = useRef(false);
  const swipeStartPos = useRef({ x: 0, y: 0 });
  const lastSwipeTick = useRef(0);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [isStartOpen, setIsStartOpen] = useState(false);
  const [currentServer, setCurrentServer] = useState<string>('public');
  const currentServerRef = useRef(currentServer);
  useEffect(() => { currentServerRef.current = currentServer; }, [currentServer]);
  const [username, setUsername] = useState(`Guest_${Math.floor(Math.random() * 9000) + 1000}`);
  const [serverInput, setServerInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [showTutorial, setShowTutorial] = useState(true);
  
  const [isConnected, setIsConnected] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  const [windows, setWindows] = useState<{id: string, title: string, isOpen: boolean, x: number, y: number, width: number, height: number, draggedBy: string | null, openedBy: string | null, icon?: React.ReactNode}[]>([
    { id: 'my-computer', title: 'My Computer', isOpen: false, x: 100, y: 100, width: 400, height: 300, draggedBy: null, openedBy: null },
    { id: 'server-join', title: 'Connect to Server', isOpen: false, x: 250, y: 200, width: 350, height: 280, draggedBy: null, openedBy: null },
    { id: 'fights-exe', title: 'Fights.exe', isOpen: false, x: 350, y: 250, width: 500, height: 380, draggedBy: null, openedBy: null },
    { id: 'shop-exe', title: 'Shop.exe', isOpen: false, x: 400, y: 300, width: 450, height: 500, draggedBy: null, openedBy: null }
  ]);
  const [time, setTime] = useState(new Date());
  const [isBooting, setIsBooting] = useState(true);

  const windowsRef = useRef(windows);
  useEffect(() => { windowsRef.current = windows; }, [windows]);

  const otherUsersRef = useRef(otherUsers);
  useEffect(() => { otherUsersRef.current = otherUsers; }, [otherUsers]);

  // Initial Socket Setup (Only runs once)
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-server', { roomName: 'public', username });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('init-state', ({ users, windows: sharedWindows, physicsObjects: sharedPhysics }: { users: any, windows: Record<string, any>, physicsObjects: Record<string, PhysicsObject> }) => {
      const { [socket.id as string]: self, ...others } = users;
      
      // If in training room, add a dummy
      if (currentServerRef.current === 'training') {
        others['dummy-id'] = {
          x: 500, y: 500, username: 'DUMMY [TRAINING]', health: 100, isReady: true, cursorMode: 'pointer'
        };
      }

      if (self) {
        setHealth(self.health);
        setIsReady(self.isReady);
      }
      setOtherUsers(others);
      if (sharedPhysics) {
        setPhysicsObjects(Object.values(sharedPhysics));
        // Add bodies for shared physics
        Object.values(sharedPhysics).forEach(obj => {
          import('matter-js').then(Matter => {
            if (!physicsEngine.current || physicsBodies.current[obj.id]) return;
            const minX = Math.min(...obj.points.map(p => p.x));
            const maxX = Math.max(...obj.points.map(p => p.x));
            const minY = Math.min(...obj.points.map(p => p.y));
            const maxY = Math.max(...obj.points.map(p => p.y));
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const body = Matter.Bodies.fromVertices(centerX, centerY, [obj.points.map(p => ({ x: p.x, y: p.y }))], {
              label: obj.id,
              restitution: 0.5,
              static: obj.heldBy !== null
            });
            if (body) {
              Matter.World.add(physicsEngine.current.world, body);
              physicsBodies.current[obj.id] = body;
            }
          });
        });
      }
      
      // Update local window state with shared state
      setWindows(prev => prev.map(w => {
        if (sharedWindows[w.id]) {
          return { 
            ...w, 
            isOpen: sharedWindows[w.id].isOpen, 
            x: sharedWindows[w.id].x, 
            y: sharedWindows[w.id].y,
            width: sharedWindows[w.id].width || w.width,
            height: sharedWindows[w.id].height || w.height,
            draggedBy: sharedWindows[w.id].draggedBy || null,
            openedBy: sharedWindows[w.id].openedBy || null
          };
        }
        return w;
      }));
    });

    socket.on('physics-object-moved', ({ id, pos }: { id: string, pos: { x: number, y: number } }) => {
      setPhysicsObjects(prev => prev.map(o => o.id === id ? { ...o, x: pos.x, y: pos.y } : o));
      const body = physicsBodies.current[id];
      if (body) {
        import('matter-js').then(Matter => {
          Matter.Body.setPosition(body, { x: pos.x, y: pos.y });
        });
      }
    });

    socket.on('window-state-changed', ({ id, state, userId }: { id: string, state: boolean, userId: string }) => {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, isOpen: state, openedBy: state ? userId : null } : w));
    });

    socket.on('window-moved', ({ id, pos, userId }: { id: string, pos: { x: number, y: number }, userId: string | null }) => {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, x: pos.x, y: pos.y, draggedBy: userId } : w));
    });

    socket.on('window-resized', ({ id, size }: { id: string, size: { width: number, height: number } }) => {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, width: size.width, height: size.height } : w));
    });

    socket.on('window-drag-start', ({ id, userId }: { id: string, userId: string }) => {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, draggedBy: userId } : w));
    });

    socket.on('window-drag-end', ({ id }: { id: string }) => {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, draggedBy: null } : w));
    });

    socket.on('user-joined', ({ id, user }: { id: string, user: any }) => {
      setOtherUsers(prev => ({ ...prev, [id]: user }));
    });

    socket.on('user-ready-changed', ({ id, isReady: ready }: { id: string, isReady: boolean }) => {
      if (id === socket.id) setIsReady(ready);
      else setOtherUsers(prev => ({ ...prev, [id]: { ...prev[id], isReady: ready } }));
    });

    socket.on('user-health-changed', ({ id, health: h }: { id: string, health: number }) => {
      let damageTaken = 0;
      let x = 0;
      let y = 0;

      if (id === socket.id) {
        damageTaken = healthRef.current - h;
        x = lastMousePos.current.x;
        y = lastMousePos.current.y;
        setHealth(h);
      } else {
        const user = otherUsersRef.current[id];
        if (user) {
          damageTaken = user.health - h;
          x = user.x;
          y = user.y;
          setOtherUsers(prev => ({ ...prev, [id]: { ...prev[id], health: h } }));
        }
      }

      if (damageTaken > 0) {
        const popupId = Math.random().toString();
        setDamagePopups(prev => [...prev.slice(-10), { id: popupId, playerId: id, amount: damageTaken, x, y }]);
        setTimeout(() => {
          setDamagePopups(prev => prev.filter(p => p.id !== popupId));
        }, 2000);
      }
    });

    socket.on('visual-swipe', ({ attackerId, from, to }: any) => {
      const swipeId = Math.random().toString();
      setSwipes(prev => [...prev, { id: swipeId, attackerId, from, to }]);
      setTimeout(() => setSwipes(prev => prev.filter(s => s.id !== swipeId)), 1200);
    });

    socket.on('physics-object-added', (obj: PhysicsObject) => {
      setPhysicsObjects(prev => [...prev, obj]);
      import('matter-js').then(Matter => {
        if (!physicsEngine.current) return;
        // Calculate center of points to create body correctly
        const minX = Math.min(...obj.points.map(p => p.x));
        const maxX = Math.max(...obj.points.map(p => p.x));
        const minY = Math.min(...obj.points.map(p => p.y));
        const maxY = Math.max(...obj.points.map(p => p.y));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Simplify vertices for Matter.js: use convex hull for reliability
        const vertices = Matter.Vertices.hull(obj.points.map(p => ({ x: p.x, y: p.y })));
        const body = Matter.Bodies.fromVertices(centerX, centerY, [vertices], {
          render: { fillStyle: obj.color },
          label: obj.id,
          restitution: 0.5,
          friction: 0.1
        });
        
        // Fallback to rectangle if vertices composition fails
        const finalBody = body || Matter.Bodies.rectangle(centerX, centerY, Math.max(20, maxX - minX), Math.max(20, maxY - minY), {
          label: obj.id,
          restitution: 0.5
        });

        if (finalBody) {
          Matter.World.add(physicsEngine.current.world, finalBody);
          physicsBodies.current[obj.id] = finalBody;
        }
      });
    });

    socket.on('game-over', ({ winnerId, winnerName }: { winnerId: string, winnerName: string }) => {
      setWinner({ id: winnerId, name: winnerName });
      setIsGameActive(false);
      if (winnerId === socket.id) {
        setMoney(m => m + 15);
      }
    });

    socket.on('physics-object-removed', (id: string) => {
      setPhysicsObjects(prev => prev.filter(o => o.id !== id));
      import('matter-js').then(Matter => {
        const body = physicsBodies.current[id];
        if (body && physicsEngine.current) {
          Matter.World.remove(physicsEngine.current.world, body);
          delete physicsBodies.current[id];
        }
      });
    });

    socket.on('physics-object-grabbed', ({ id, userId }: { id: string, userId: string }) => {
      setPhysicsObjects(prev => prev.map(o => o.id === id ? { ...o, heldBy: userId } : o));
      import('matter-js').then(Matter => {
        const body = physicsBodies.current[id];
        if (body) {
          Matter.Body.setStatic(body, true);
        }
      });
    });

    socket.on('physics-object-thrown', ({ id, velocity }: { id: string, velocity: { x: number, y: number } }) => {
      setPhysicsObjects(prev => prev.map(o => o.id === id ? { ...o, heldBy: null, throwsRemaining: o.throwsRemaining - 1 } : o));
      import('matter-js').then(Matter => {
        const body = physicsBodies.current[id];
        if (body) {
          Matter.Body.setStatic(body, false);
          Matter.Body.setVelocity(body, { x: velocity.x * 0.2, y: velocity.y * 0.2 });
        }
      });
    });

    socket.on('game-reset', (usersMap: any) => {
      setHealth(100);
      setIsReady(false);
      setIsGameActive(false);
      setWinner(null);
      setCountdown(null);
      const { [socket.id as string]: self, ...others } = usersMap;
      setOtherUsers(others);
    });

    socket.on('user-moved', ({ id, pos }: { id: string, pos: { x: number, y: number } }) => {
      setOtherUsers(prev => {
        if (!prev[id]) return prev;
        return { ...prev, [id]: { ...prev[id], ...pos } };
      });
    });

    socket.on('user-disconnected', (id: string) => {
      setOtherUsers(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    const timer = setInterval(() => setTime(new Date()), 1000);
    setTimeout(() => setIsBooting(false), 2500);

    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, []); // Truly stable initialization

  // Mouse Listeners handled separately to use latest state refs
  useEffect(() => {
  // Normalized coordinates (0-1000)
    const normalize = (pos: { x: number, y: number }) => {
      const bounds = desktopRef.current?.getBoundingClientRect();
      if (!bounds) return pos;
      return {
        x: (pos.x - bounds.left) / bounds.width * 1000,
        y: (pos.y - bounds.top) / bounds.height * 1000
      };
    };

    const denormalize = (pos: { x: number, y: number }) => {
      const bounds = desktopRef.current?.getBoundingClientRect();
      if (!bounds) return pos;
      return {
        x: (pos.x / 1000) * bounds.width,
        y: (pos.y / 1000) * bounds.height
      };
    };

    const checkAutoclicker = () => {
      const now = Date.now();
      clickTimes.current = clickTimes.current.filter(t => now - t < 1000);
      clickTimes.current.push(now);
      if (clickTimes.current.length > 15) {
        setIsAutoclicker(true);
        setTimeout(() => setIsAutoclicker(false), 2000);
        return true;
      }
      return false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const screenPos = { x: e.clientX, y: e.clientY };
      const pos = normalize(screenPos);
      setMousePos(pos);
      
      if (cursorModeRef.current === 'pencil' && isSwiping.current) {
        setCurrentDrawing(prev => {
          const last = prev[prev.length - 1];
          if (!last) return [{ x: pos.x, y: pos.y }];
          const dist = Math.sqrt(Math.pow(pos.x - last.x, 2) + Math.pow(pos.y - last.y, 2));
          if (dist > 10) return [...prev, { x: pos.x, y: pos.y }];
          return prev;
        });
      }

      if (grabbedObjectId.current) {
        const body = physicsBodies.current[grabbedObjectId.current];
        if (body) {
          import('matter-js').then(Matter => {
            Matter.Body.setPosition(body, { x: pos.x, y: pos.y });
          });
          socketRef.current?.emit('move-physics-object', { id: grabbedObjectId.current, pos });
        }
      }

      // Charge Mechanic logic: Only fills if speed is VERY low
      if (isSwiping.current && cursorModeRef.current === 'pointer') {
         const speed = Math.sqrt(mouseVelocity.current.x**2 + mouseVelocity.current.y**2);
         if (speed < 2) { // Extremely slow movement allows charging
            if (chargeStartTime.current === null) {
              chargeStartTime.current = Date.now();
            } else {
              const elapsed = Date.now() - chargeStartTime.current;
              const progress = Math.min(1, elapsed / 2500); // 2.5 seconds to full
              setChargeProgress(progress);
              if (progress >= 1 && !isCharged.current) {
                isCharged.current = true;
                // Add a small kick effect or sound here later
              }
            }
         } else {
            // Moving too fast resets charge
            setChargeProgress(0);
            chargeStartTime.current = null;
            isCharged.current = false;
         }
      }

      const desktopBounds = desktopRef.current?.getBoundingClientRect();
      if (desktopBounds) {
        setUiMousePos({
          x: e.clientX - desktopBounds.left,
          y: e.clientY - desktopBounds.top
        });
      }
      
      mouseVelocity.current = {
        x: Math.abs(pos.x - lastMousePos.current.x),
        y: Math.abs(pos.y - lastMousePos.current.y)
      };
      lastMousePos.current = pos;

      if (socketRef.current?.connected) {
        socketRef.current.emit('mouse-move', { ...pos, mode: cursorModeRef.current });
      }

      // Continuous Swipe Damage
      const fightsOpen = windowsRef.current.find(w => w.id === 'fights-exe')?.isOpen;
      const vel = mouseVelocity.current.x + mouseVelocity.current.y;
      
      if (isSwiping.current && cursorModeRef.current === 'pointer' && (fightsOpen || isGameActiveRef.current) && vel > 20) {
        const now = Date.now();
        
        // Visual trail locally
        const distFromLast = Math.sqrt(Math.pow(pos.x - lastTrailPoint.current.x, 2) + Math.pow(pos.y - lastTrailPoint.current.y, 2));
        if (distFromLast > 15) {
          const swipeId = Math.random().toString();
          const from = lastTrailPoint.current;
          const to = pos;
          
          if (isCharged.current) {
            socketRef.current?.emit('swipe-attack', { from, to, isCharged: true });
            setSwipes(prev => [...prev, { id: swipeId, attackerId: socketRef.current?.id || '', from, to, color: '#facc15' }]);
            isCharged.current = false;
            setChargeProgress(0);
            chargeStartTime.current = null;
          } else {
            socketRef.current?.emit('swipe-attack', { from, to });
            setSwipes(prev => [...prev, { id: swipeId, attackerId: socketRef.current?.id || '', from, to, color: '#60a5fa' }]);
          }
          
          setTimeout(() => setSwipes(prev => prev.filter(s => s.id !== swipeId)), 800);
          lastTrailPoint.current = pos;
        }

        if (now - lastSwipeTick.current > 100) { // Tick every 100ms
          Object.entries(otherUsersRef.current).forEach(([id, user]) => {
            const u = user as UserState;
            const dist = Math.sqrt(Math.pow(pos.x - u.x, 2) + Math.pow(pos.y - u.y, 2));
            if (dist < 60) {
              socketRef.current?.emit('damage-player', { targetId: id, damage: 3 });
              lastSwipeTick.current = now;
            }
          });
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Find what was clicked
      const target = e.target as HTMLElement;
      const isWindowOrButton = target.closest('.xp-window') || target.closest('button') || target.closest('.cursor-pointer');
      
      const fightsIcon = target.closest('[data-id="fights-exe"]');
      if ((winner || health <= 0) && fightsIcon) {
        socketRef.current?.emit('reset-game');
      }

      setIsClicked(true);
      const isCheating = checkAutoclicker();
      const pos = normalize({ x: e.clientX, y: e.clientY });
      swipeStartPos.current = pos;
      lastTrailPoint.current = pos;
      isSwiping.current = true;

      if (e.button === 0) { // LEFT CLICK
        if (cursorModeRef.current === 'pencil') {
          setCurrentDrawing([{ x: pos.x, y: pos.y }]);
        } else {
          // Check if grabbing a physics object
          const grabbed = physicsObjectsRef.current.find(obj => {
            const dist = Math.sqrt(Math.pow(pos.x - obj.x, 2) + Math.pow(pos.y - obj.y, 2));
            return dist < 50 && (obj.heldBy === null || obj.heldBy === socketRef.current?.id);
          });
          
          if (grabbed) {
            grabbedObjectId.current = grabbed.id;
            socketRef.current?.emit('grab-physics-object', grabbed.id);
          }
        }
      }

      if (e.button === 2) { // RIGHT CLICK
        e.preventDefault();
        if (cursorModeRef.current === 'pencil' && currentDrawing.length > 3) {
          // Auto-close loop if points are close
          let points = [...currentDrawing];
          const first = points[0];
          const last = points[points.length - 1];
          const gap = Math.sqrt((first.x - last.x)**2 + (first.y - last.y)**2);
          if (gap > 50) {
            // Close it explicitly
            points.push({ ...first });
          }
          
          // Calculate sharpness for damage
          let sharpnessScore = 0;
          for (let i = 1; i < points.length - 1; i++) {
            const p1 = points[i-1];
            const p2 = points[i];
            const p3 = points[i+1];
            const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
            let diff = Math.abs(angle1 - angle2);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff > 0.8) sharpnessScore += 1; // It's a "sharp" turn
          }
          const damage = Math.min(8, Math.max(1, Math.round(sharpnessScore / 2) + 1));

          const newObj: PhysicsObject = {
            id: Math.random().toString(),
            points,
            x: points[0].x,
            y: points[0].y,
            angle: 0,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            creatorId: socketRef.current?.id || '',
            heldBy: null,
            throwsRemaining: 2,
            createdAt: Date.now(),
            damage
          };
          socketRef.current?.emit('add-physics-object', newObj);
          setCurrentDrawing([]);
        }
      }

      // Click attack detection
      const fightsOpen = windowsRef.current.find(w => w.id === 'fights-exe')?.isOpen;
      
      // If we clicked on UI, don't trigger attack unless it's the game area
      if (isWindowOrButton && !target.closest('#desktop-canvas')) {
        // Just UI interaction
      } else if (cursorModeRef.current === 'pointer' && (fightsOpen || isGameActiveRef.current)) {
        if (!isCheating) {
          Object.entries(otherUsersRef.current).forEach(([id, user]) => {
            const u = user as UserState;
            const dist = Math.sqrt(Math.pow(pos.x - u.x, 2) + Math.pow(pos.y - u.y, 2));
            if (dist < 50) { 
              socketRef.current?.emit('damage-player', { targetId: id, damage: 2 });
            }
          });
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsClicked(false);
      lastSwipeTick.current = 0;
      setChargeProgress(0);
      chargeStartTime.current = null;
      isCharged.current = false;

      if (grabbedObjectId.current) {
        const vel = mouseVelocity.current;
        socketRef.current?.emit('throw-physics-object', { id: grabbedObjectId.current, velocity: vel });
        grabbedObjectId.current = null;
      }

      if (isSwiping.current) {
        const endPos = normalize({ x: e.clientX, y: e.clientY });
        const vel = mouseVelocity.current.x + mouseVelocity.current.y;
        
        const fightsOpen = windowsRef.current.find(w => w.id === 'fights-exe')?.isOpen;
        if (cursorModeRef.current === 'pointer' && (fightsOpen || isGameActiveRef.current) && vel > 45) { // Normalized velocity
          socketRef.current?.emit('swipe-attack', { from: swipeStartPos.current, to: endPos });
          // Final swipe burst damage
          Object.entries(otherUsersRef.current).forEach(([id, user]) => {
            const u = user as UserState;
            const d = lineToPointDistance(swipeStartPos.current, endPos, { x: u.x, y: u.y });
            if (d < 40) {
              socketRef.current?.emit('damage-player', { targetId: id, damage: 5 });
            }
          });
        }
        isSwiping.current = false;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      scrollAccumulator.current += e.deltaY;
      if (Math.abs(scrollAccumulator.current) > 120) {
        const direction = scrollAccumulator.current > 0 ? 1 : -1;
        scrollAccumulator.current = 0;
        setCursorMode(prev => {
          const modes: any[] = unlockedModes;
          const idx = modes.indexOf(prev);
          const next = modes[(idx + direction + modes.length) % modes.length];
          setShowModeSwitch(true);
          setTimeout(() => setShowModeSwitch(false), 1200);
          return next;
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setCursorMode(prev => {
          const modes: any[] = unlockedModes;
          const idx = modes.indexOf(prev);
          const next = modes[(idx + 1) % modes.length];
          setShowModeSwitch(true);
          setTimeout(() => setShowModeSwitch(false), 1000);
          return next;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', (e) => e.preventDefault());
    };
  }, []); // Truly stable event handlers
  const shopItems = [
    { id: 'eraser', name: 'Recycle Bin', price: 20, icon: '/recycle-bin.png', desc: 'Deletes whatever it touches' },
    { id: 'hammer', name: 'Hammer.exe', price: 35, icon: 'https://img.icons8.com/pixel-serif/64/null/hammer.png', desc: 'Crushing damage' },
    { id: 'spray', name: 'Spray.dll', price: 50, icon: 'https://img.icons8.com/pixel-serif/64/null/paint-spray.png', desc: 'Damage over time' },
    { id: 'bucket', name: 'Fill Tool', price: 75, icon: 'https://img.icons8.com/pixel-serif/64/null/paint-bucket.png', desc: 'Creates heavy objects' },
    { id: 'stamp', name: 'Stamp.vbs', price: 100, icon: 'https://img.icons8.com/pixel-serif/64/null/stamp.png', desc: 'Creates terrain' },
  ];

  const buyItem = (itemId: string, price: number) => {
    const isTraining = currentServerRef.current === 'training';
    if ((isTraining || money >= price) && !unlockedModes.includes(itemId)) {
      if (!isTraining) setMoney(m => m - price);
      setUnlockedModes(prev => [...prev, itemId]);
    }
  };

  const lineToPointDistance = (p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}) => {
    const px = p2.x - p1.x;
    const py = p2.y - p1.y;
    const l2 = px * px + py * py;
    if (l2 === 0) return Math.sqrt(Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2));
    let t = ((p3.x - p1.x) * px + (p3.y - p1.y) * py) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(p3.x - (p1.x + t * px), 2) + Math.pow(p3.y - (p1.y + t * py), 2));
  };

  // Game Logic: Check for countdown
  useEffect(() => {
    const fightsOpen = windows.find(w => w.id === 'fights-exe')?.isOpen;
    if (!fightsOpen) return;

    const participants = [
      { id: socketRef.current?.id, isReady },
      ...Object.entries(otherUsers).map(([id, u]) => ({ id, isReady: (u as UserState).isReady }))
    ];

      if (participants.length >= 2 && participants.every(p => p.isReady) && countdown === null && !isGameActive) {
        let count = 3;
        setCountdown(count);
        const counter = setInterval(() => {
          count -= 1;
          if (count === 0) {
            setCountdown(0);
            clearInterval(counter);
            setTimeout(() => {
              setCountdown(null);
              setIsGameActive(true);
              // Ensure we close the window correctly for everyone
              socketRef.current?.emit('window-toggle', { id: 'fights-exe', state: false });
            }, 1000);
          } else {
            setCountdown(count);
          }
        }, 1000);
      }
  }, [isReady, otherUsers, windows]);

  const handleJoinServer = (sName: string, uName: string) => {
    const finalServer = sName.trim().toLowerCase() || 'public';
    const finalUser = uName.trim() || username;
    
    setCurrentServer(finalServer);
    setUsername(finalUser);
    
    socketRef.current?.emit('join-server', { roomName: finalServer, username: finalUser });
    setOtherUsers({});
    setWindows(prev => prev.map(w => w.id === 'server-join' ? { ...w, isOpen: false } : w));
    setShowTutorial(false);
  };

  const toggleWindow = (id: string, state: boolean) => {
    setWindows(prev => {
      const w = prev.find(window => window.id === id);
      if (w && w.isOpen === state) return prev; // Avoid redundant updates
      return prev.map(w => w.id === id ? { ...w, isOpen: state, openedBy: state ? socketRef.current?.id || null : null } : w);
    });
    // Emit to server for shared windows
    if (id !== 'server-join') {
      socketRef.current?.emit('window-toggle', { id, state });
    }
  };

  const handleDragWindowStart = (id: string, info: any) => {
    const w = windowsRef.current.find(win => win.id === id);
    if (!w) return;
    
    // Only allow drag if no one is dragging or I am the one who was dragging
    if (w.draggedBy && w.draggedBy !== socketRef.current?.id) return;
    
    // Calculate offset: mouse position - window top-left position (normalized)
    const desktopBounds = desktopRef.current?.getBoundingClientRect();
    if (desktopBounds) {
      const mouseX = ((info.point.x - desktopBounds.left) / desktopBounds.width) * 1000;
      const mouseY = ((info.point.y - desktopBounds.top) / desktopBounds.height) * 1000;
      dragOffset.current = {
        x: mouseX - w.x,
        y: mouseY - w.y
      };
    }
    
    socketRef.current?.emit('window-drag-start', { id });
  };

  const handleDragWindowMove = (id: string, info: any) => {
    const w = windowsRef.current.find(win => win.id === id);
    if (!w || (w.draggedBy && w.draggedBy !== socketRef.current?.id)) return;
    
    if (id === 'server-join') return;
    const desktopBounds = desktopRef.current?.getBoundingClientRect();
    if (!desktopBounds) return;

    // Use preserved offset for accurate positioning
    const x = ((info.point.x - desktopBounds.left) / desktopBounds.width) * 1000 - dragOffset.current.x;
    const y = ((info.point.y - desktopBounds.top) / desktopBounds.height) * 1000 - dragOffset.current.y;
    
    socketRef.current?.emit('window-move', { id, pos: { x, y } });
  };

  const handleDragWindowEnd = (id: string) => {
    socketRef.current?.emit('window-drag-end', { id });
  };

  const handleResizeWindow = (id: string, width: number, height: number) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, width, height } : w));
    socketRef.current?.emit('window-resize', { id, size: { width, height } });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-screen w-screen bg-[#1a1a1a] flex items-center justify-center overflow-hidden p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative h-full max-h-[1080px] aspect-[4/3] bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)] border-8 border-gray-900 rounded-lg overflow-hidden"
      >
        <div 
          ref={desktopRef}
          id="desktop-canvas"
          className="relative h-full w-full bg-[#3a6ea5] select-none font-sans overflow-hidden" 
        >
          {/* Windows XP Logo in background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none select-none">
            <img src="/windows-xp.webp" className="w-[60vw] max-w-[600px] object-contain" alt="Windows XP" onError={(e) => (e.target as any).style.display='none'} />
          </div>
        <AnimatePresence>
          {isBooting && (
            <motion.div 
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-black pointer-events-none flex flex-col items-center justify-center"
            >
              <div className="static-overlay opacity-40 animate-pulse" />
              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
                <motion.div 
                  initial={{ x: -64 }}
                  animate={{ x: 256 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="w-16 h-full bg-blue-500 shadow-[0_0_15px_#3b82f6]"
                />
              </div>
              <span className="text-white font-mono text-[10px] mt-4 tracking-widest opacity-50 uppercase">Initialising System...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Static noise that fades out */}
        <motion.div 
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 4, delay: 2 }}
          className="static-overlay"
        />

        <AnimatePresence>
          {health <= 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-[500] bg-red-900/40 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto"
            >
              <motion.h1 
                initial={{ scale: 0.5, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="text-white text-6xl pixel-text drop-shadow-[0_8px_0_rgba(0,0,0,1)] uppercase mb-8"
              >
                Eliminated
              </motion.h1>
              <button 
                onClick={() => socketRef.current?.emit('reset-game')}
                className="bg-white border-4 border-black px-8 py-4 pixel-text text-black hover:bg-gray-200 active:translate-y-1 transition-transform shadow-[8px_8px_0_rgba(0,0,0,1)]"
              >
                Sync Respawn
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout">
          {damagePopups.map(popup => (
            <motion.div
              key={popup.id}
              initial={{ y: 20, opacity: 0, scale: 0.5 }}
              animate={{ y: -60, opacity: 1, scale: 1.5 }}
              exit={{ opacity: 0, scale: 2 }}
              transition={{ duration: 0.8, ease: "backOut" }}
              className="absolute z-[200] pointer-events-none select-none"
              style={{ left: `${(popup.x / 1000) * 100}%`, top: `${(popup.y / 1000) * 100}%`, transform: 'translateX(-50%)' }}
            >
              <span className="text-red-500 pixel-text text-xl drop-shadow-[0_4px_0_rgba(0,0,0,1)]">
                -{popup.amount}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Global Swipes Visualizer */}
        <div className="absolute inset-0 pointer-events-none z-[100]">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="charged-glow">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feFlood floodColor="#facc15" result="glowColor" />
                <feComposite in="glowColor" in2="blur" operator="in" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <AnimatePresence>
              {swipes.map(swipe => (
                <motion.line
                  key={swipe.id}
                  x1={swipe.from.x}
                  y1={swipe.from.y}
                  x2={swipe.to.x}
                  y2={swipe.to.y}
                  stroke={swipe.color || (swipe.attackerId === socketRef.current?.id ? "white" : "#ff3333")}
                  strokeWidth={swipe.color === '#facc15' ? "20" : "12"}
                  strokeLinecap="round"
                  initial={{ opacity: 1, pathLength: 0 }}
                  animate={{ opacity: 0, pathLength: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{ filter: swipe.color === '#facc15' ? 'url(#charged-glow)' : 'url(#glow)' }}
                />
              ))}
            </AnimatePresence>
          </svg>
        </div>

        {/* Countdown Overlay */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ scale: 3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 z-[150] flex items-center justify-center pointer-events-none"
            >
              <span className="text-white text-6xl md:text-8xl pixel-text drop-shadow-[0_4px_0_rgba(0,0,0,1)] uppercase italic text-center px-4">
                {countdown === 0 ? "FIGHT!" : countdown}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Background Image (XP Bliss) */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: 'url("https://images.hdqwalls.com/download/windows-xp-bliss-4k-lu-3840x2160.jpg")' }}
          referrerPolicy="no-referrer"
        />

        {/* Physics Objects Layer */}
        <div className="absolute inset-0 pointer-events-none z-[15]">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {currentDrawing.length > 1 && (
              <polyline
                points={currentDrawing.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="black"
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="opacity-100"
              />
            )}
            {physicsObjects.map(obj => {
              // Calculate points relative to body position
              const minX = Math.min(...obj.points.map(p => p.x));
              const minY = Math.min(...obj.points.map(p => p.y));
              const maxX = Math.max(...obj.points.map(p => p.x));
              const maxY = Math.max(...obj.points.map(p => p.y));
              const centerX = (minX + maxX) / 2;
              const centerY = (minY + maxY) / 2;
              
              const points = obj.points.map(p => `${p.x - centerX},${p.y - centerY}`).join(' ');

              return (
                <g 
                  key={obj.id} 
                  transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.angle * (180 / Math.PI)})`}
                  className={obj.heldBy ? 'opacity-90' : 'opacity-100'}
                >
                  <polygon
                    points={points}
                    fill="white"
                    stroke={obj.color}
                    strokeWidth="3"
                    className="drop-shadow-lg"
                  />
                  {obj.damage > 5 && (
                    <circle r="6" fill="#facc15" className="animate-pulse" />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* ... (Tutorial remains the same) */}
        {showTutorial && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="tutorial-bubble bottom-12 left-4"
          >
            <div className="flex items-start gap-2">
              <Info size={16} className="text-blue-600 mt-0.5" />
              <div>
                <p className="font-bold">Welcome to XP!</p>
                <p>Click the <b>start</b> button below and select <b>Connect Server</b> to join others!</p>
              </div>
            </div>
            <button onClick={() => setShowTutorial(false)} className="absolute top-1 right-1 text-gray-500 hover:text-black">
              <X size={12} />
            </button>
          </motion.div>
        )}

        {/* Desktop Icons */}
        <div className="relative z-10 p-4 grid grid-cols-1 gap-8 w-24 translate-y-2">
          <DesktopIcon 
            icon={<img src="/XPIcon.webp" className="w-8 h-8 pixelated" alt="Computer" onError={(e) => (e.target as any).src="https://img.icons8.com/color/48/000000/monitor.png"} />} 
            label="My Computer" 
            onClick={() => toggleWindow('my-computer', true)}
          />
          <DesktopIcon 
            icon={<img src="/recycle-bin.png" className="w-8 h-8 pixelated" alt="Recycle Bin" onError={(e) => (e.target as any).src="https://img.icons8.com/color/48/000000/recycle-bin.png"} />} 
            label="Recycle Bin" 
            onClick={() => {}}
          />
          <DesktopIcon 
            icon={<img src="https://img.icons8.com/plasticine/100/shopping-cart.png" className="w-8 h-8" alt="Shop" />} 
            label="Shop.exe" 
            onClick={() => toggleWindow('shop-exe', true)}
          />
          <div className="relative group" data-id="fights-exe">
            <div className={`transition-opacity ${isGameActive ? 'opacity-50' : ''}`}>
              <DesktopIcon 
                icon={<Swords className="text-red-400 drop-shadow-lg pixel-icon" size={32} />} 
                label="Fights.exe" 
                onClick={() => {
                  if (winner || health <= 0) {
                    socketRef.current?.emit('reset-game');
                  } else if (!isGameActive) {
                    toggleWindow('fights-exe', true);
                  }
                }}
              />
            </div>
            {isGameActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -translate-y-4">
                <div className="bg-yellow-400 p-1 border-2 border-black rotate-12 shadow-[4px_4px_0_rgba(0,0,0,1)]">
                   <Lock size={24} className="text-black" />
                </div>
                <span className="text-[7px] pixel-text text-yellow-400 bg-black/80 px-1 mt-1 border border-yellow-400 drop-shadow-sm">IN GAME</span>
              </div>
            )}
          </div>
          <DesktopIcon 
            icon={<Shield className="text-white drop-shadow-lg pixel-icon" size={32} />} 
            label="Firewall" 
          />
          <DesktopIcon 
            icon={<Folder className="text-yellow-200 drop-shadow-lg pixel-icon" size={32} />} 
            label="My Documents" 
          />
        </div>

        {/* Windows */}
        <AnimatePresence>
          {windows.map(window => {
            const fightsOpen = windows.find(w => w.id === 'fights-exe')?.isOpen;
            // Privatize windows: only shared during active combat or if specifically Fights.exe is active
            const isVisible = window.isOpen && (
              window.openedBy === socketRef.current?.id || 
              (isGameActive && (window.id === 'fights-exe' || fightsOpen)) || 
              (window.id === 'fights-exe' && fightsOpen)
            );
            
            if (!isVisible) return null;

            return (
              <motion.div
                key={window.id}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1, 
                  left: `${((window.x as number) / 1000) * 100}%`, 
                  top: `${((window.y as number) / 1000) * 100}%`,
                  width: window.width,
                  height: window.height
                }}
                exit={{ scale: 0.95, opacity: 0 }}
                drag={!window.draggedBy || window.draggedBy === socketRef.current?.id}
                dragMomentum={false}
                dragConstraints={desktopRef}
                onDragStart={(e, info) => handleDragWindowStart(window.id, info)}
                onDrag={(e, info) => handleDragWindowMove(window.id, info)}
                onDragEnd={() => handleDragWindowEnd(window.id)}
                className={`absolute z-20 xp-window xp-pixelated-window overflow-hidden flex flex-col ${window.draggedBy && window.draggedBy !== socketRef.current?.id ? 'opacity-70 pointer-events-none' : ''}`}
                style={{ 
                  boxShadow: window.draggedBy ? '0 20px 40px rgba(0,0,0,0.4)' : '0 10px 20px rgba(0,0,0,0.2)'
                }}
              >
                <div className="xp-window-header cursor-move">
                  <div className="xp-window-title pixel-text text-[9px] uppercase tracking-tighter">
                    {window.id === 'my-computer' && <Monitor size={14} className="pixel-icon" />}
                    {window.id === 'server-join' && <Link size={14} className="pixel-icon" />}
                    {window.id === 'fights-exe' && <Swords size={14} className="pixel-icon" />}
                    <span>{window.title} {window.draggedBy && window.draggedBy !== socketRef.current?.id && "(DRAGGED BY OTHER)"}</span>
                  </div>
                  <div className="xp-window-controls" onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => toggleWindow(window.id, false)} className="xp-control-button bg-[#3d95ff] border border-white/50 w-5 h-5 flex items-center justify-center"><Minimize2 size={10} /></button>
                    <button className="xp-control-button bg-[#3d95ff] border border-white/50 w-5 h-5 flex items-center justify-center"><Square size={8} /></button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.id === 'fights-exe' && isGameActive) return;
                        toggleWindow(window.id, false);
                      }}
                      className={`xp-control-button ${isGameActive && window.id === 'fights-exe' ? 'bg-gray-500 opacity-50 cursor-not-allowed' : 'bg-[#e91010] active:bg-[#c00]'} border border-white/50 w-5 h-5 flex items-center justify-center`}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-4 bg-white m-0.5 overflow-auto border-t border-gray-400 relative">
                  {window.id === 'shop-exe' ? (
                    <div className="p-4 bg-gray-100 h-full flex flex-col gap-4 overflow-auto">
                      <div className="bg-white border-2 border-blue-400 p-3 rounded shadow-inner mb-2">
                        <p className="font-bold text-blue-800 text-lg">
                          BALANCE: {currentServerRef.current === 'training' ? "∞ (TRAINING)" : `$${money}`}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {shopItems.map(item => (
                          <div key={item.id} className="flex items-center gap-3 bg-white p-3 border border-gray-300 rounded hover:border-blue-400 transition-colors">
                            <img src={item.icon} className="w-12 h-12 pixelated object-contain" alt={item.name} />
                            <div className="flex-1">
                              <h4 className="font-bold text-sm tracking-tight">{item.name}</h4>
                              <p className="text-[10px] text-gray-500 leading-tight">{item.desc}</p>
                            </div>
                            <button 
                              onClick={() => buyItem(item.id, item.price)}
                              disabled={unlockedModes.includes(item.id) || (currentServerRef.current !== 'training' && money < item.price)}
                              className={`px-3 py-1 text-xs font-bold rounded ${unlockedModes.includes(item.id) ? 'bg-green-100 text-green-700' : 'bg-green-600 text-white hover:bg-green-500'} disabled:bg-gray-300 disabled:text-gray-500`}
                            >
                              {unlockedModes.includes(item.id) ? 'BOUGHT' : `$${item.price}`}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : window.id === 'my-computer' && (
                    <div className="grid grid-cols-4 gap-4 items-start content-start">
                      <div className="flex flex-col items-center gap-1 p-2 hover:bg-blue-100 cursor-pointer rounded border border-transparent hover:border-blue-300">
                        <HardDrive className="text-gray-600" size={40} />
                        <span className="text-xs">Local Disk (C:)</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 p-2 hover:bg-blue-100 cursor-pointer rounded border border-transparent hover:border-blue-300">
                        <HardDrive className="text-gray-600" size={40} />
                        <span className="text-xs">Local Disk (D:)</span>
                      </div>
                    </div>
                  )}

                  {window.id === 'server-join' && (
                    <div className="flex flex-col gap-4">
                      {/* ... (Existing join content) */}
                      <div>
                        <label className="text-xs font-bold block mb-1 uppercase tracking-tight">Your Name:</label>
                        <div className="flex gap-2 items-center">
                          <User size={16} className="text-gray-500" />
                          <input 
                            type="text" 
                            value={usernameInput || username}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            placeholder="Type username..."
                            className="flex-1 border-2 border-gray-400 p-1 px-2 text-sm focus:outline-none focus:border-blue-600 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold block mb-1 uppercase tracking-tight">Room ID:</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={serverInput}
                            onChange={(e) => setServerInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoinServer(serverInput, usernameInput)}
                            placeholder="e.g. coolest-room"
                            className="flex-1 border-2 border-gray-400 p-1 px-2 text-sm focus:outline-none focus:border-blue-600 bg-white"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => handleJoinServer(serverInput, usernameInput)}
                        className="bg-[#ece9d8] border-2 border-gray-600 px-4 py-2 text-sm font-bold active:border-white active:bg-gray-400 shadow-[inset_-1px_-1px_1px_rgba(0,0,0,0.5)] self-end"
                      >
                        Sync & Connect
                      </button>
                    </div>
                  )}

                  {window.id === 'fights-exe' && (
                    <div className="flex flex-col gap-4 h-full">
                      <div className="flex items-center gap-2 border-b-2 border-gray-100 pb-2">
                        <Swords size={24} className="text-red-500" />
                        <div>
                          <h2 className="text-lg font-black italic tracking-tighter uppercase leading-none">Mouse Fights Online</h2>
                          <p className="text-[10px] text-gray-500 font-bold">ALPHA VERSION 1.0.4</p>
                        </div>
                      </div>

                      {winner && (
                        <div className="bg-yellow-100 border-2 border-yellow-400 p-3 text-center animate-bounce">
                          <p className="text-sm font-black uppercase text-yellow-800">🏆 WINNER: {winner.name} 🏆</p>
                          <button 
                            onClick={() => socketRef.current?.emit('reset-game')}
                            className="mt-2 bg-blue-600 text-white px-4 py-1 text-xs font-bold border-b-4 border-blue-800 active:border-b-0 active:translate-y-1"
                          >
                            RESTART GAME
                          </button>
                        </div>
                      )}

                      <div className="flex-1 overflow-auto bg-gray-50 border border-gray-200 rounded p-2">
                        <h3 className="text-xs font-bold mb-2 uppercase border-b border-gray-200 pb-1">Participants ({Object.keys(otherUsers).length + 1})</h3>
                        <div className="space-y-3">
                          <PlayerRow 
                            name={username + " (YOU)"} 
                            health={health} 
                            isReady={isReady} 
                            onReady={() => socketRef.current?.emit('player-ready', !isReady)}
                            isSelf={true}
                          />
                          {Object.entries(otherUsers).map(([id, user]) => (
                            <React.Fragment key={id}>
                              <PlayerRow 
                                name={(user as UserState).username} 
                                health={(user as UserState).health} 
                                isReady={(user as UserState).isReady}
                                isSelf={false}
                              />
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resize Handle */}
                <div 
                  className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-[30] group/resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = window.width;
                    const startHeight = window.height;

                    const onMouseMove = (moveEvent: MouseEvent) => {
                      const newWidth = Math.max(300, startWidth + (moveEvent.clientX - startX));
                      const newHeight = Math.max(250, startHeight + (moveEvent.clientY - startY));
                      handleResizeWindow(window.id, newWidth, newHeight);
                    };

                    const onMouseUp = () => {
                      window.removeEventListener('mousemove', onMouseMove);
                      window.removeEventListener('mouseup', onMouseUp);
                    };

                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                  }}
                >
                  <div className="absolute bottom-1 right-1 w-4 h-4 border-r-2 border-b-2 border-gray-400 group-hover/resize:border-blue-500 transition-colors" />
                  <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400 group-hover/resize:border-blue-500 transition-colors" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* ... (Taskbar and Start Menu same as before) */}
        <div className="absolute bottom-0 left-0 right-0 h-10 xp-taskbar z-40 flex items-center px-0">
          <button 
            onClick={() => {
              setIsStartOpen(!isStartOpen);
              setShowTutorial(false);
            }}
            className="xp-start-button h-full px-4 flex items-center gap-2 hover:brightness-110 active:brightness-90 transition-all cursor-none"
          >
            <div className="bg-white/20 p-1 rounded-full">
              <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                <div className="bg-[#f04e23]" />
                <div className="bg-[#8ec63f]" />
                <div className="bg-[#00adef]" />
                <div className="bg-[#ffb901]" />
              </div>
            </div>
            <span className="text-lg">start</span>
          </button>

          <div className="flex-1 flex px-2 gap-1 overflow-hidden" />

          <div className="xp-taskbar bg-[#0996f1] h-full flex items-center px-4 border-l border-[#0877c1] text-white text-xs drop-shadow gap-2">
            <div className="flex items-center gap-2">
              <Chrome size={14} />
              <Monitor size={14} />
            </div>
            <span className="font-bold">{formatTime(time)}</span>
          </div>
        </div>

        <AnimatePresence>
          {isStartOpen && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-10 left-0 w-80 h-[450px] bg-white z-30 shadow-2xl rounded-t-lg overflow-hidden border-2 border-[#245edb]"
            >
              <div className="h-16 bg-gradient-to-b from-[#1941a5] to-[#245edb] p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded border-2 border-white bg-blue-300 flex items-center justify-center overflow-hidden">
                  <Monitor className="text-white" />
                </div>
                <span className="text-white font-bold text-lg truncate pr-2">{username}</span>
              </div>
              <div className="flex h-[calc(100%-116px)]">
                <div className="w-1/2 p-2 border-r border-blue-100 flex flex-col gap-1">
                  <div className="flex items-center gap-2 p-1 hover:bg-blue-600 hover:text-white cursor-pointer rounded group">
                    <Chrome size={20} className="text-blue-500 group-hover:text-white" />
                    <span className="text-xs">Internet Explorer</span>
                  </div>
                  <div className="flex items-center gap-2 p-1 hover:bg-blue-600 hover:text-white cursor-pointer rounded group">
                    <Folder size={20} className="text-yellow-500 group-hover:text-white" />
                    <span className="text-xs">E-mail</span>
                  </div>
                  
                  <div className="border-t border-gray-200 my-1" />

                  <div 
                    onClick={() => {
                      toggleWindow('server-join', true);
                      setIsStartOpen(false);
                    }}
                    className="flex items-center gap-2 p-1 hover:bg-blue-600 hover:text-white cursor-pointer rounded group"
                  >
                    <Link size={20} className="text-green-500 group-hover:text-white" />
                    <span className="text-xs font-bold">Connect Server</span>
                  </div>
                </div>
                <div className="w-1/2 bg-[#d3e5fa] p-2 flex flex-col gap-2">
                  <span className="text-xs font-bold text-[#1941a5] px-1 hover:bg-blue-600 hover:text-white cursor-pointer py-1 rounded">My Documents</span>
                  <span className="text-xs font-bold text-[#1941a5] px-1 hover:bg-blue-600 hover:text-white cursor-pointer py-1 rounded">My Pictures</span>
                  <span className="text-xs font-bold text-[#1941a5] px-1 hover:bg-blue-600 hover:text-white cursor-pointer py-1 rounded">My Music</span>
                  <div className="mt-auto flex flex-col gap-1">
                    <span className="text-xs font-bold text-[#1941a5] px-1 hover:bg-blue-600 hover:text-white cursor-pointer py-1 rounded">Control Panel</span>
                    <span className="text-xs font-bold text-[#1941a5] px-1 hover:bg-blue-600 hover:text-white cursor-pointer py-1 rounded">Help and Support</span>
                  </div>
                </div>
              </div>
              <div className="h-10 bg-[#245edb] flex items-center justify-end px-4 gap-4">
                <button className="text-white text-xs flex items-center gap-1 hover:underline">
                  <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center font-bold">L</div>
                  Log Off
                </button>
                <button className="text-white text-xs flex items-center gap-1 hover:underline">
                  <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center font-bold">T</div>
                  Turn Off Computer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Custom Cursor Artifact (Global - Local) */}
        <div 
          className="custom-cursor pointer-events-none"
          style={{ 
            left: uiMousePos.x,
            top: uiMousePos.y,
            zIndex: 10000,
            transform: 'translate(-2px, -2px)'
          }}
        >
          <CustomCursorIcon isClicked={isClicked} mode={cursorMode} chargeProgress={chargeProgress} color={health <= 0 ? "#555" : (isGameActive ? "#60a5fa" : "white")} />
          
          <AnimatePresence>
            {isAutoclicker && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 2 }}
                className="absolute left-1/2 -top-12 -translate-x-1/2 bg-red-600 text-white border-2 border-white px-3 py-1 rounded shadow-xl z-50 whitespace-nowrap"
              >
                <div className="flex items-center gap-2">
                   <Shield size={16} />
                   <span className="pixel-text text-[10px] uppercase font-bold tracking-widest">Autoclicker Detected!</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showModeSwitch && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, y: -60 }}
                animate={{ opacity: 1, scale: 1, y: -160 }}
                exit={{ opacity: 0, scale: 0.8, y: -180 }}
                className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              >
                <div className="bg-[#ccc] border-[2px] border-t-white border-l-white border-b-gray-800 border-r-gray-800 p-1 shadow-2xl flex flex-col items-center min-w-[70px]">
                  <div className="bg-[#000080] text-white text-[7px] px-2 py-0.5 w-full text-center uppercase font-bold mb-1 border-b border-black">
                    {cursorMode}
                  </div>
                  <div className="relative w-10 h-10 bg-white border-2 border-gray-500 flex items-center justify-center overflow-hidden shadow-inner">
                    <motion.div
                      key={cursorMode}
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <img 
                        src={
                          cursorMode === 'pencil' ? '/Pen_mouse.png' :
                          cursorMode === 'eraser' ? '/recycle-bin.png' :
                          cursorMode === 'hammer' ? 'https://img.icons8.com/pixel-serif/64/null/hammer.png' :
                          cursorMode === 'spray' ? 'https://img.icons8.com/pixel-serif/64/null/paint-spray.png' :
                          cursorMode === 'bucket' ? 'https://img.icons8.com/pixel-serif/64/null/paint-bucket.png' :
                          cursorMode === 'stamp' ? 'https://img.icons8.com/pixel-serif/64/null/stamp.png' :
                          'https://img.icons8.com/pixel-serif/64/null/pencil.png'
                        }
                        className="w-8 h-8 object-contain pixelated"
                        alt={cursorMode}
                      />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Self Health Bar */}
          {(isGameActive || health < 100) && (
            <div className="absolute top-8 left-4 flex flex-col gap-1 items-start w-[64px]">
              <div className="w-16 h-2 flex-shrink-0 bg-gray-900 border-2 border-black overflow-hidden shadow-[2px_2px_0_rgba(0,0,0,1)] relative">
                <motion.div 
                  animate={{ width: `${health}%` }}
                  className="h-full bg-red-600 opacity-50 absolute inset-0"
                  transition={{ duration: 1.5, ease: "linear" }}
                />
                <motion.div 
                  animate={{ width: `${health}%` }}
                  className="h-full bg-red-500 absolute inset-0"
                  transition={{ duration: 0.1 }}
                />
              </div>
              <div className="flex justify-start w-full">
                <span className="pixel-text text-[6px] text-white bg-black/50 px-1 border border-white/20 whitespace-nowrap inline-block drop-shadow-[0_1px_0_rgba(0,0,0,1)]">{health} HP</span>
              </div>
            </div>
          )}
        </div>

        {/* Other Users' Cursors */}
        {Object.entries(otherUsers).map(([id, user]) => {
          const u = user as UserState;
          return (
            <motion.div 
              key={id}
              className="custom-cursor pointer-events-none"
              animate={{ 
                left: `${(u.x / 1000) * 100}%`,
                top: `${(u.y / 1000) * 100}%`
              }}
              transition={{ duration: 0.05, ease: "linear" }}
              style={{ zIndex: 9000 }}
            >
              <CustomCursorIcon mode={(user as UserState).cursorMode} color={(user as UserState).health <= 0 ? "#555" : "#ff6b6b"} />
              <div className="absolute top-8 left-4 flex flex-col gap-0.5 min-w-[64px]">
                <div className="bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-sm whitespace-nowrap border border-white/20 mb-0.5">
                  {(user as UserState).username} {(user as UserState).isReady && "✓"}
                </div>
                {(isGameActive || (user as UserState).health < 100) && (
                  <div className="flex flex-col gap-1 items-start w-[64px]">
                    <div className="w-16 h-2 flex-shrink-0 bg-gray-900 border-2 border-black relative overflow-hidden shadow-[2px_2px_0_rgba(0,0,0,1)]">
                      <motion.div 
                        animate={{ width: `${(user as UserState).health}%` }}
                        className="h-full bg-red-600 opacity-50 absolute inset-0"
                        transition={{ duration: 1.5, ease: "linear" }}
                      />
                      <motion.div 
                        animate={{ width: `${(user as UserState).health}%` }}
                        className="h-full bg-red-500 absolute inset-0"
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                    <span className="pixel-text text-[6px] text-white bg-black/50 px-1 border border-white/20 whitespace-nowrap drop-shadow-[0_1px_0_rgba(0,0,0,1)]">{(user as UserState).health} HP</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        </div>
      </motion.div>
    </div>
  );
}

function DesktopIcon({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <div 
      className="flex flex-col items-center gap-1 cursor-pointer hover:bg-white/10 p-2 rounded transition-colors active:bg-white/20 select-none group w-20"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <div className="group-active:scale-95 transition-transform flex items-center justify-center p-1 bg-white/5 rounded-sm border border-transparent group-hover:border-white/20">
        {icon}
      </div>
      <span className="text-[8px] text-white pixel-text text-center break-words leading-tight drop-shadow-[0_2px_0_rgba(0,0,0,1)]">
        {label}
      </span>
    </div>
  );
}

