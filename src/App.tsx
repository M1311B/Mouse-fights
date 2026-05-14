/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { Monitor, Trash2, Folder, HardDrive, Chrome, X, Minimize2, Maximize, Minimize, Square, Link, Info, User, Shield, Swords, Zap, Activity, Lock, Pencil, LogIn, LogOut, AlertTriangle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { auth, db, googleProvider, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, signInWithPopup } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const isPointInPoly = (p: {x: number, y: number}, poly: {x: number, y: number}[]) => {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Custom Mouse Cursor SVG with Click Effect
const CustomCursorIcon = ({ color = 'white', isClicked = false, mode = 'pointer', chargeProgress = 0, isLassoActive = false, lassoAngle = 0 }: { color?: string, isClicked?: boolean, mode?: string, chargeProgress?: number, isLassoActive?: boolean, lassoAngle?: number }) => {
  const getIcon = () => {
    switch(mode) {
      case 'pencil': return '/Pen_mouse.png';
      case 'eraser': return '/recycle-bin.png';
      case 'hammer': return 'https://img.icons8.com/pixel-serif/64/null/hammer.png';
      case 'spray': return 'https://img.icons8.com/pixel-serif/64/null/paint-spray.png';
      case 'bucket': return 'https://img.icons8.com/pixel-serif/64/null/paint-bucket.png';
      case 'stamp': return 'https://img.icons8.com/pixel-serif/64/null/stamp.png';
      case 'lasso': return '/Lasso head.png';
      default: {
        if (mode.includes('bsod')) return '/BSOD.png';
        if (mode.includes('storm')) return 'https://img.icons8.com/color/96/commercial.png';
        return null;
      }
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
          style={{ 
            transform: mode === 'lasso' || mode === 'hammer' ? 'translate(-50%, -50%)' : 'none'
          }}
        >
          <img 
            src={iconSrc || "/Pen_mouse.png"} 
            alt={mode} 
            className={`${mode === 'lasso' ? 'w-16 h-16' : 'w-10 h-10'} object-contain pixelated drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]`} 
            style={{ 
              transform: (mode === 'lasso' && isLassoActive) ? `rotate(${lassoAngle}deg)` : 'none'
            }}
            onError={(e) => { (e.target as any).src = "https://img.icons8.com/pixel-serif/64/null/pencil.png" }}
          />
          {mode === 'lasso' && isLassoActive && (
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] font-bold px-1 rounded-sm border border-black animate-bounce shadow-sm">
                READY
             </div>
          )}
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

// Rope component for lasso
const LassoRope = ({ from, to }: { from: { x: number, y: number }, to: { x: number, y: number }, key?: string | number }) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Create a springy/wavy path for the rope
  const segments = 16;
  const pathPoints = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const px = from.x + dx * t;
    const py = from.y + dy * t;
    
    // Wave complexity
    const waveFreq = dist > 200 ? 2 : 1;
    const waveSpeed = Date.now() / 150;
    const waveAmp = Math.sin(t * Math.PI) * (dist / 15);
    const wave = Math.sin(t * Math.PI * waveFreq + waveSpeed) * waveAmp * 0.3;
    
    const perpX = -dy / (dist || 1);
    const perpY = dx / (dist || 1);
    
    // Subtle gravity sag (more sag in middle)
    const sag = Math.sin(t * Math.PI) * (dist / 5);
    
    pathPoints.push({
      x: px + (perpX * wave),
      y: py + (perpY * wave) + sag
    });
  }

  const pathD = `M ${pathPoints[0].x} ${pathPoints[0].y} ` + 
                pathPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');

  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-[5000]" 
      viewBox="0 0 1000 1000" 
      preserveAspectRatio="none"
      style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}
    >
      <motion.path 
        d={pathD} 
        fill="none" 
        stroke="#78350f" 
        strokeWidth="10" 
        strokeLinecap="round"
        className="opacity-50"
      />
      <motion.path 
        d={pathD} 
        fill="none" 
        stroke="#d97706" 
        strokeWidth="5" 
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        className="opacity-90"
      />
    </svg>
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
  cursorMode: 'pointer' | 'pencil' | 'eraser' | 'hammer' | 'spray' | 'bucket' | 'stamp' | 'lasso';
  isRagdoll?: boolean;
}

interface PlayerRowProps {
  name: string;
  health: number;
  stamina?: number;
  isReady: boolean;
  onReady?: () => void;
  isSelf: boolean;
}

function PlayerRow(props: PlayerRowProps) {
  const { name, health, stamina, isReady, onReady, isSelf } = props;
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
    <div className="flex flex-col gap-1 p-2 bg-white border border-gray-300 shadow-sm">
      <div className="flex items-center gap-3">
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
      
      {isSelf && stamina !== undefined && (
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between items-center">
             <span className="text-[8px] font-bold text-blue-400">STAMINA</span>
             <span className="text-[8px] font-mono">{Math.round(stamina)}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 border border-gray-400">
             <motion.div 
               animate={{ width: `${stamina}%` }}
               className="h-full bg-blue-400"
             />
          </div>
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
  const presenceSyncRef = useRef<Record<string, number>>({});
  const [health, setHealth] = useState(100);
  const [stamina, setStamina] = useState(100);
  const [lastSwipeTime, setLastSwipeTime] = useState(0);
  const [cursorMode, setCursorMode] = useState<'pointer' | 'pencil'>('pointer');
  const cursorModeRef = useRef(cursorMode);
  useEffect(() => { 
    cursorModeRef.current = cursorMode;
    if (cursorMode !== 'pencil' && currentDrawingRef.current.length > 2) {
      // Auto-convert drawing when switching away from pencil
      const points = [...currentDrawingRef.current];
      // Close loop
      points.push({ ...points[0] });
      
      const newObj: PhysicsObject = {
        id: Math.random().toString(),
        points,
        x: points.reduce((acc, p) => acc + p.x, 0) / points.length,
        y: points.reduce((acc, p) => acc + p.y, 0) / points.length,
        angle: 0,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        creatorId: socketRef.current?.id || '',
        heldBy: null,
        throwsRemaining: 2,
        createdAt: Date.now(),
        damage: 3
      };
      socketRef.current?.emit('add-physics-object', newObj);
      setCurrentDrawing([]);
    }
    cursorModeRef.current = cursorMode; 
  }, [cursorMode]);

  const [unlockedModes, setUnlockedModes] = useState<string[]>(['pointer', 'pencil', 'lasso', 'bsod', 'storm']);
  const [serverUnlockedItems, setServerUnlockedItems] = useState<string[]>([]);
  const [isBSODActive, setIsBSODActive] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const isFrozenRef = useRef(false);
  const [bsodGlitched, setBsodGlitched] = useState(false);
  const [adPopups, setAdPopups] = useState<{id: string, x: number, y: number, content: string}[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [selectedShopItemId, setSelectedShopItemId] = useState<string | null>(null);
  const [winner, setWinner] = useState<{id: string, name: string} | null>(null);

  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const isWheelOpenRef = useRef(isWheelOpen);
  useEffect(() => { isWheelOpenRef.current = isWheelOpen; }, [isWheelOpen]);
  
  const [wheelSelection, setWheelSelection] = useState<string | null>(null);
  const wheelSelectionRef = useRef(wheelSelection);
  useEffect(() => { wheelSelectionRef.current = wheelSelection; }, [wheelSelection]);
  
  const unlockedModesRef = useRef(unlockedModes);
  useEffect(() => { unlockedModesRef.current = unlockedModes; }, [unlockedModes]);
  
  const serverUnlockedItemsRef = useRef(serverUnlockedItems);
  useEffect(() => { serverUnlockedItemsRef.current = serverUnlockedItems; }, [serverUnlockedItems]);
  
  const cooldownsRef = useRef(cooldowns);
  useEffect(() => { cooldownsRef.current = cooldowns; }, [cooldowns]);

  const [lassoContraction, setLassoContraction] = useState<{ points: {x: number, y: number}[], victims: string[], center: {x: number, y: number} } | null>(null);

  const [lassoState, setLassoState] = useState<{ active: boolean, swingAngle: number, fired: boolean, targetId: string | null, startTime: number, ropePoints: {x: number, y: number}[] }>({ active: false, swingAngle: 0, fired: false, targetId: null, startTime: 0, ropePoints: [] });
  const lassoStateRef = useRef(lassoState);
  useEffect(() => { lassoStateRef.current = lassoState; }, [lassoState]);
  const circleDetectionPoints = useRef<{x: number, y: number, t: number}[]>([]);
  const lassoTargetVelocity = useRef({ x: 0, y: 0 });
  const lassoAnchorRef = useRef<any>(null);
  const lassoConstraintRef = useRef<any>(null);

  useEffect(() => {
    if (cursorMode === 'lasso' && lassoState.active && !lassoState.fired) {
      const interval = setInterval(() => {
        setLassoState(prev => ({ ...prev, swingAngle: (prev.swingAngle + 15) % 360 }));
      }, 16);
      return () => clearInterval(interval);
    }
  }, [cursorMode, lassoState.active, lassoState.fired]);

  const detectCircularMotion = (newPoint: {x: number, y: number}) => {
    if (cursorModeRef.current !== 'lasso') return;
    const now = Date.now();
    circleDetectionPoints.current.push({ ...newPoint, t: now });
    
    // Maintain a 1-second window of points
    circleDetectionPoints.current = circleDetectionPoints.current.filter(p => now - p.t < 1000);
    
    if (circleDetectionPoints.current.length < 5) return;

    // Calculate center of recent motion
    const avgX = circleDetectionPoints.current.reduce((a, b) => a + b.x, 0) / circleDetectionPoints.current.length;
    const avgY = circleDetectionPoints.current.reduce((a, b) => a + b.y, 0) / circleDetectionPoints.current.length;
    
    // Calculate total angular change
    let totalAngle = 0;
    for (let i = 1; i < circleDetectionPoints.current.length; i++) {
      const p1 = circleDetectionPoints.current[i-1];
      const p2 = circleDetectionPoints.current[i];
      const a1 = Math.atan2(p1.y - avgY, p1.x - avgX);
      const a2 = Math.atan2(p2.y - avgY, p2.x - avgX);
      let diff = a2 - a1;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      totalAngle += diff;
    }

    // Trigger if we've done roughly 0.8 rotations
    if (Math.abs(totalAngle) > Math.PI * 1.6 && !lassoStateRef.current.active) {
      setLassoState(prev => ({ ...prev, active: true, swingAngle: 0 }));
    }
  };

  const [chargeProgress, setChargeProgress] = useState(0);
  const chargeStartTime = useRef<number | null>(null);
  const isCharged = useRef(false);
  const chargeLocation = useRef({ x: 0, y: 0 });

  const healthRef = useRef(health);
  useEffect(() => { healthRef.current = health; }, [health]);

  const [money, setMoney] = useState(0);
  const [currentServer, setCurrentServer] = useState<string>('public');
  const currentServerRef = useRef(currentServer);
  useEffect(() => { currentServerRef.current = currentServer; }, [currentServer]);

  useEffect(() => {
    if (currentServer === 'training') {
      setMoney(7000);
      const interval = setInterval(() => {
        setOtherUsers(prev => {
          if (!prev['dummy-id'] || !prev['dummy-id'].isReady) {
            return {
              ...prev,
              ['dummy-id']: {
                x: 500, y: 500, username: 'DUMMY [TRAINING]', health: prev['dummy-id']?.health ?? 100, isReady: true, cursorMode: 'pointer'
              }
            };
          }
          return prev;
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentServer]);
  const [showModeSwitch, setShowModeSwitch] = useState(false);
  const [lastModeChange, setLastModeChange] = useState(0);
  const scrollAccumulator = useRef(0);
  const clickTimes = useRef<number[]>([]);
  const [isAutoclicker, setIsAutoclicker] = useState(false);

  const [physicsObjects, setPhysicsObjects] = useState<PhysicsObject[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<{x: number, y: number}[]>([]);
  const currentDrawingRef = useRef(currentDrawing);
  useEffect(() => { currentDrawingRef.current = currentDrawing; }, [currentDrawing]);
  const MatterRef = useRef<any>(null);
  const physicsEngine = useRef<any>(null);
  const physicsBodies = useRef<Record<string, any>>({});
  const lastPhysicsUpdateTime = useRef(0);
  const physicsAccumulator = useRef(0);
  const lastForceMoveEmit = useRef(0);
  const grabbedObjectId = useRef<string | null>(null);
  const eventRef = useRef<any>({});

  const physicsObjectsRef = useRef(physicsObjects);
  useEffect(() => { physicsObjectsRef.current = physicsObjects; }, [physicsObjects]);

  // Matter.js Initialization
  useEffect(() => {
    import('matter-js').then(Matter => {
      MatterRef.current = Matter;
      const engine = Matter.Engine.create();
      engine.gravity.y = 1.0; // Standardized gravity
      physicsEngine.current = engine;

      // Add a static box around the desktop
      const ground = Matter.Bodies.rectangle(500, 995, 1200, 50, { 
        isStatic: true,
        label: 'ground',
        friction: 0.8,
        restitution: 0.2
      });
      const leftWall = Matter.Bodies.rectangle(-25, 500, 50, 1200, { isStatic: true });
      const rightWall = Matter.Bodies.rectangle(1025, 500, 50, 1200, { isStatic: true });
      const ceiling = Matter.Bodies.rectangle(500, -25, 1200, 50, { isStatic: true });
      Matter.World.add(engine.world, [ground, leftWall, rightWall, ceiling]);

      const runner = (time: number) => {
        if (!physicsEngine.current || !MatterRef.current) {
          requestAnimationFrame(runner);
          return;
        }
        const Matter = MatterRef.current;
        const engine = physicsEngine.current;

        if (!lastPhysicsUpdateTime.current) lastPhysicsUpdateTime.current = time;
        const dt = Math.min(64, time - lastPhysicsUpdateTime.current);
        lastPhysicsUpdateTime.current = time;

        physicsAccumulator.current += dt;
        const fixedDelta = 1000 / 60;

        while (physicsAccumulator.current >= fixedDelta) {
          Matter.Engine.update(engine, fixedDelta);
          physicsAccumulator.current -= fixedDelta;
        }
        
        // Handle Lasso Swing in Physics
        const lasso = lassoStateRef.current;
        if (lasso.fired && lasso.targetId) {
          // Auto-expire after 6 seconds
          if (lasso.startTime && Date.now() - lasso.startTime > 6000) {
            setLassoState(prev => ({ ...prev, fired: false, targetId: null }));
          }

          const targetId = lasso.targetId;
          const targetBodyId = `player-ragdoll-${targetId}`;
          const targetBody = physicsBodies.current[targetBodyId];
          
          if (targetBody) {
            // Ensure Anchor exists
            if (!lassoAnchorRef.current) {
              lassoAnchorRef.current = Matter.Bodies.circle(lastMousePos.current.x, lastMousePos.current.y, 5, { isStatic: true, isSensor: true });
              Matter.World.add(physicsEngine.current.world, lassoAnchorRef.current);
            }
            
            // Update Anchor Pos
            Matter.Body.setPosition(lassoAnchorRef.current, { x: lastMousePos.current.x, y: lastMousePos.current.y });
            
            // Ensure Constraint exists
            if (!lassoConstraintRef.current) {
              lassoConstraintRef.current = Matter.Constraint.create({
                bodyA: lassoAnchorRef.current,
                bodyB: targetBody,
                stiffness: 0.2, // Snappier
                damping: 0.05,
                length: 100, // Slightly shorter
                render: { visible: false }
              });
              Matter.World.add(physicsEngine.current.world, lassoConstraintRef.current);
            }
            
            // Sync target pos with throttling (30fps sync)
            const nowTick = Date.now();
            if (nowTick - lastForceMoveEmit.current > 33) {
              if (targetId === 'dummy-id') {
                 setOtherUsers(prev => ({
                   ...prev,
                   ['dummy-id']: { ...prev['dummy-id'], x: targetBody.position.x, y: targetBody.position.y }
                 }));
              } else {
                 socketRef.current?.emit('force-move', { targetId, pos: { x: targetBody.position.x, y: targetBody.position.y } });
              }
              lastForceMoveEmit.current = nowTick;
            }
          }
        } else {
          // Cleanup Lasso constraints if not fired
          if (lassoConstraintRef.current) {
            Matter.World.remove(physicsEngine.current.world, lassoConstraintRef.current);
            lassoConstraintRef.current = null;
          }
          if (lassoAnchorRef.current) {
            Matter.World.remove(physicsEngine.current.world, lassoAnchorRef.current);
            lassoAnchorRef.current = null;
          }
        }
        
        // Sync bodies to state
        const updatedObjects: any[] = [];
        let needsStateUpdate = false;

        const now = Date.now();

        // Sync player ragdolls
        const ragdollUpdates: Record<string, {x: number, y: number}> = {};
        let localRagdollUpdate: {x: number, y: number} | null = null;
        
        Object.entries(physicsBodies.current).forEach(([id, b]) => {
          const body = b as any;
          if (id.startsWith('player-ragdoll-')) {
            const userId = id.replace('player-ragdoll-', '');
            const isMe = userId === socketRef.current?.id;
            
            if (isMe) {
              localRagdollUpdate = { x: body.position.x, y: body.position.y };
            } else {
              ragdollUpdates[userId] = { x: body.position.x, y: body.position.y };
            }

            // Damage on impact
            const speedSq = body.velocity.x**2 + body.velocity.y**2;
            if (speedSq > 225 && (body.position.x < 40 || body.position.x > 960 || body.position.y < 40 || body.position.y > 960)) {
              const speed = Math.sqrt(speedSq);
              const damageAmount = Math.floor(speed / 2.5);
              if (isMe) setHealth(h => Math.max(0, h - damageAmount));
              else socketRef.current?.emit('damage-player', { targetId: userId, damage: damageAmount });

              setScreenShake(true);
              setTimeout(() => setScreenShake(false), 200);

              const popupId = Math.random().toString();
              setDamagePopups(prev => [...prev.slice(-10), { id: popupId, playerId: userId, amount: damageAmount, x: body.position.x, y: body.position.y }]);
              setTimeout(() => setDamagePopups(prev => prev.filter(p => p.id !== popupId)), 2000);
            }
          }
        });

        // Apply local player updates
        if (localRagdollUpdate) {
           const { x, y } = localRagdollUpdate;
           lastMousePos.current = { x, y };
           setMousePos({ x, y });
           setUiMousePos({ x: x / 10, y: y / 10 });
           if (Date.now() - lastForceMoveEmit.current > 33) {
             socketRef.current?.emit('mouse-move', { x, y });
             lastForceMoveEmit.current = Date.now();
           }
        }

        // Apply remote ragdoll updates
        if (Object.keys(ragdollUpdates).length > 0) {
          setOtherUsers(prev => {
            const next = { ...prev };
            let changed = false;
            Object.entries(ragdollUpdates).forEach(([uid, pos]) => {
              if (next[uid] && (Math.abs(next[uid].x - pos.x) > 0.5 || Math.abs(next[uid].y - pos.y) > 0.5)) {
                next[uid] = { ...next[uid], ...pos };
                changed = true;
              }
            });
            return changed ? next : prev;
          });
        }

        Object.entries(physicsBodies.current).forEach(([id, b]) => {
          if (id.startsWith('player-ragdoll-')) return; // handled above
          const body = b as any;
          const obj = physicsObjectsRef.current.find(o => o.id === id);
          if (obj) {
            // Auto-cleanup: 30 seconds without being held
            if (obj.heldBy === null && now - obj.createdAt > 30000 && obj.creatorId === socketRef.current?.id) {
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
            const fightsOpen = windowsRef.current.find(w => w.id === 'fights-exe')?.isOpen;
            
            const isTraining = currentServerRef.current === 'training';
            
            if (speed > 5 && obj.heldBy === null && (fightsOpen || isGameActiveRef.current || isTraining)) {
              Object.entries(otherUsersRef.current).forEach(([uid, user]) => {
                const u = user as UserState;
                if (u.health <= 0) return; // Don't hit dead players
                const dist = Math.sqrt(Math.pow(body.position.x - u.x, 2) + Math.pow(body.position.y - u.y, 2));
                if (dist < 60) {
                  if (uid === 'dummy-id') {
                    setOtherUsers(prev => ({
                      ...prev,
                      ['dummy-id']: { ...prev['dummy-id'], health: Math.max(0, prev['dummy-id'].health - obj.damage) }
                    }));
                  } else {
                    socketRef.current?.emit('damage-player', { targetId: uid, damage: obj.damage });
                  }
                  // Remove object after hit
                  socketRef.current?.emit('remove-physics-object', id);
                }
              });
              
              // Also check self
              if (healthRef.current > 0 && (isTraining || obj.creatorId !== socketRef.current?.id)) {
                const dist = Math.sqrt(Math.pow(body.position.x - lastMousePos.current.x, 2) + Math.pow(body.position.y - lastMousePos.current.y, 2));
                if (dist < 60) {
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
  const [screenShake, setScreenShake] = useState(false);
  const isGameActiveRef = useRef(isGameActive);
  useEffect(() => { isGameActiveRef.current = isGameActive; }, [isGameActive]);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [swipes, setSwipes] = useState<{id: string, attackerId: string, from: {x: number, y: number}, to: {x: number, y: number}, color?: string}[]>([]);
  const lastTrailPoint = useRef({ x: 0, y: 0 });
  const [damagePopups, setDamagePopups] = useState<{id: string, playerId: string, amount: number, x: number, y: number}[]>([]);
  const [hitSparks, setHitSparks] = useState<{id: string, x: number, y: number}[]>([]);
  
  const mouseVelocity = useRef({ x: 0, y: 0 });
  const lastVelocities = useRef<{x: number, y: number}[]>([]);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastScreenPos = useRef({ x: 0, y: 0 });
  const isSwiping = useRef(false);
  const swipeStartPos = useRef({ x: 0, y: 0 });
  const lastSwipeTick = useRef(0);
  const dragOffset = useRef({ x: 0, y: 0 });
  const swipePath = useRef<{x: number, y: number, t: number}[]>([]);
  const isMouseDown = useRef(false);
  const swipeStartTime = useRef(0);

  // Stamina regeneration
  useEffect(() => {
    const interval = setInterval(() => {
      setStamina(prev => Math.min(100, prev + 2));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const [isStartOpen, setIsStartOpen] = useState(false);
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('xp_username') || `Guest_${Math.floor(Math.random() * 9000) + 1000}`;
  });
  const [serverInput, setServerInput] = useState('');
  const [usernameInput, setUsernameInput] = useState(username);

  useEffect(() => {
    localStorage.setItem('xp_username', username);
  }, [username]);
  const [showTutorial, setShowTutorial] = useState(true);
  
  const [isConnected, setIsConnected] = useState(false);
  
  const [isRagdoll, setIsRagdoll] = useState(false);
  const isRagdollRef = useRef(false);
  useEffect(() => { isRagdollRef.current = isRagdoll; }, [isRagdoll]);

  const socketRef = useRef<Socket | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  const [windows, setWindows] = useState<{id: string, title: string, isOpen: boolean, x: number, y: number, width: number, height: number, draggedBy: string | null, openedBy: string | null, icon?: React.ReactNode}[]>([
    { id: 'my-computer', title: 'My Computer', isOpen: false, x: 100, y: 100, width: 400, height: 300, draggedBy: null, openedBy: null },
    { id: 'server-join', title: 'Connect to Server', isOpen: false, x: 250, y: 200, width: 350, height: 280, draggedBy: null, openedBy: null },
    { id: 'fights-exe', title: 'Fights.exe', isOpen: false, x: 350, y: 250, width: 500, height: 380, draggedBy: null, openedBy: null },
    { id: 'shop-exe', title: 'Shop.exe', isOpen: false, x: 400, y: 300, width: 450, height: 500, draggedBy: null, openedBy: null },
    { id: 'explorer-exe', title: 'Windows Explorer', isOpen: false, x: 150, y: 150, width: 550, height: 400, draggedBy: null, openedBy: null },
    { id: 'browser-exe', title: 'Internet Explorer', isOpen: false, x: 200, y: 120, width: 600, height: 500, draggedBy: null, openedBy: null }
  ]);
  const [time, setTime] = useState(new Date());
  const [isBooting, setIsBooting] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    // 1. Sync local status to Firestore for cross-region presence
    if (!isConnected || !socketRef.current?.id) return;
    
    // We use a stable ID (Auth UID if logged in, else stable socket ID)
    const pId = currentUser?.uid || socketRef.current.id;
    const pRef = doc(db, 'rooms', 'public', 'presences', pId);
    
    const syncPresence = async () => {
      try {
        await setDoc(pRef, {
          id: socketRef.current?.id || pId,
          uid: currentUser?.uid || null,
          username,
          x: mousePos.x,
          y: mousePos.y,
          health,
          isReady,
          cursorMode,
          lastActive: new Date().toISOString()
        });
      } catch (e) {
        // Silently fail if offline
      }
    };

    const interval = setInterval(syncPresence, 500); // 2hz for global sync is enough as fallback
    return () => {
      clearInterval(interval);
      // Clean up on leave
      const cleanup = async () => {
        try { await updateDoc(pRef, { lastActive: '2000-01-01T00:00:00Z' }); } catch {}
      };
      cleanup();
    };
  }, [isConnected, mousePos, health, isReady, cursorMode, username, currentUser]);

  useEffect(() => {
    // 2. Listen to Firestore for other players (Global sync)
    // This bridges users across different server instances
    const colRef = collection(db, 'rooms', 'public', 'presences');
    const unsub = onSnapshot(colRef, (snapshot) => {
      setOtherUsers(prev => {
        const next = { ...prev };
        snapshot.docs.forEach(d => {
          const data = d.data();
          const pId = d.id;
          
          // Skip self
          if (pId === (currentUser?.uid || socketRef.current?.id)) return;
          
          // Stale check (10s)
          const lastSeen = new Date(data.lastActive).getTime();
          if (Date.now() - lastSeen > 10000) {
            delete next[pId];
            return;
          }

          // Merge Firestore data into otherUsers
          // We only update if this user isn't already being updated faster by Socket.io
          // (Socket updates are handled in .on('user-moved') etc)
          const lastSocketUpdate = presenceSyncRef.current[pId] || 0;
          if (Date.now() - lastSocketUpdate > 1000) {
             next[pId] = {
               x: data.x,
               y: data.y,
               username: data.username,
               health: data.health,
               isReady: data.isReady,
               cursorMode: data.cursorMode,
               isRagdoll: data.isRagdoll || false
             };
          }
        });
        return next;
      });
    }, (err) => handleFirestoreError(err, OperationType.GET, 'rooms/public/presences'));
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    isFrozenRef.current = isFrozen;
  }, [isFrozen]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      if (user) {
        setUsername(user.displayName || `User_${user.uid.slice(0, 4)}`);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync state with Firestore
  useEffect(() => {
    if (!currentUser || currentUser.uid.startsWith('guest-')) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMoney(data.money ?? 0);
        setUnlockedModes(data.unlockedModes ?? ['pointer', 'pencil']);
      } else {
        // Initialize user doc if it doesn't exist
        const initialData = {
          username: currentUser.displayName || username,
          email: currentUser.email,
          money: 0,
          unlockedModes: ['pointer', 'pencil'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setDoc(userDocRef, initialData).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Persist local state changes to Firestore
  useEffect(() => {
    if (!currentUser || currentUser.uid.startsWith('guest-')) return;
    const userDocRef = doc(db, 'users', currentUser.uid);
    
    // Using a debounced or throttled approach would be better, 
    // but for simple stats like money/modes we can just update.
    // To avoid loops with onSnapshot, we can use metadata or just trust Firestore's local cache.
    const updateSession = async () => {
      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data();
          // Only update if local state is different and we have data
          if (JSON.stringify(data.unlockedModes) !== JSON.stringify(unlockedModes) || data.money !== money) {
             await updateDoc(userDocRef, {
               money,
               unlockedModes,
               updatedAt: new Date().toISOString()
             }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`));
          }
        }
      } catch (err) {
        console.error("Firestore sync error:", err);
      }
    };

    updateSession();
  }, [money, unlockedModes, currentUser]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    // Allow user to switch accounts in the UI
    setUsernameInput('');
    socketRef.current?.disconnect();
    setIsConnected(false);
    toggleWindow('server-join', true);
  };

  const windowsRef = useRef(windows);
  useEffect(() => { windowsRef.current = windows; }, [windows]);

  const otherUsersRef = useRef(otherUsers);
  useEffect(() => { otherUsersRef.current = otherUsers; }, [otherUsers]);

  // Initial Socket Setup (Only runs once)
  useEffect(() => {
    // Setup more robust connection with transports fallback and automatic reconnection
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });
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
        setMoney(7000);
      } else {
        // Reset money if leaving training? (User didn't ask but usually training is sandbox)
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
          const Matter = MatterRef.current;
          if (!Matter || !physicsEngine.current || physicsBodies.current[obj.id]) return;
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

    socket.on('user-effect', ({ userId, effect, duration }: { userId: string, effect: string, duration: number }) => {
      if (effect === 'ragdoll') {
        const isMe = userId === socketRef.current?.id;
        if (isMe) {
          setIsRagdoll(true);
        }
        
        setOtherUsers(prev => {
          if (!prev[userId]) return prev;
          return { ...prev, [userId]: { ...prev[userId], isRagdoll: true } };
        });

        import('matter-js').then(Matter => {
          if (!physicsEngine.current) return;
          const bodyId = `player-ragdoll-${userId}`;
          
          if (physicsBodies.current[bodyId]) return;

          let startPos = { x: 500, y: 500 };
          if (isMe) {
            startPos = { x: lastMousePos.current.x, y: lastMousePos.current.y };
          } else if (otherUsersRef.current[userId]) {
            startPos = { x: otherUsersRef.current[userId].x, y: otherUsersRef.current[userId].y };
          }

          const body = Matter.Bodies.circle(startPos.x, startPos.y, 40, {
            label: bodyId,
            restitution: 0.6,
            friction: 0.1,
            frictionAir: 0.01,
            density: 0.005 // Slightly heavier for dragging
          });
          
          // Small kick
          Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 10, y: -10 });
          
          Matter.World.add(physicsEngine.current.world, body);
          physicsBodies.current[bodyId] = body;

          const cleanup = () => {
             if (isMe) setIsRagdoll(false);
             setOtherUsers(prev => {
               if (!prev[userId]) return prev;
               return { ...prev, [userId]: { ...prev[userId], isRagdoll: false } };
             });
             const b = physicsBodies.current[bodyId];
             if (b && physicsEngine.current) {
               Matter.World.remove(physicsEngine.current.world, b);
               delete physicsBodies.current[bodyId];
             }
          };

          setTimeout(() => {
            if (lassoStateRef.current.targetId === userId) {
              const interval = setInterval(() => {
                if (lassoStateRef.current.targetId !== userId) {
                   clearInterval(interval);
                   cleanup();
                }
              }, 200);
            } else {
              cleanup();
            }
          }, duration);
        });
      }
    });

    socket.on('physics-object-moved', ({ id, pos }: { id: string, pos: { x: number, y: number } }) => {
      setPhysicsObjects(prev => prev.map(o => o.id === id ? { ...o, x: pos.x, y: pos.y } : o));
      const body = physicsBodies.current[id];
      if (body && MatterRef.current) {
        MatterRef.current.Body.setPosition(body, { x: pos.x, y: pos.y });
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

    socket.on('swipe-attack', ({ attackerId, from, to, isCharged: charged }: { attackerId: string, from: {x: number, y: number}, to: {x: number, y: number}, isCharged?: boolean }) => {
      const swipeId = Math.random().toString();
      setSwipes(prev => [...prev.slice(-15), { id: swipeId, attackerId, from, to, color: charged ? '#facc15' : undefined }]);
      setTimeout(() => setSwipes(prev => prev.filter(s => s.id !== swipeId)), charged ? 2500 : 1200);

      if (attackerId !== socketRef.current?.id) {
        const dist = lineToPointDistance(from, to, lastMousePos.current);
        if (dist < 40) {
          setHealth(h => Math.max(0, h - (charged ? 5 : 1))); 
        }
      }
    });

    socket.on('visual-swipe', ({ attackerId, from, to, isCharged: charged }: any) => {
      const swipeId = Math.random().toString();
      setSwipes(prev => [...prev, { id: swipeId, attackerId, from, to, color: charged ? '#facc15' : undefined }]);
      setTimeout(() => setSwipes(prev => prev.filter(s => s.id !== swipeId)), charged ? 2500 : 1200);
    });

    socket.on('physics-object-added', (obj: PhysicsObject) => {
      setPhysicsObjects(prev => [...prev, obj]);
      import('matter-js').then(Matter => {
        if (!physicsEngine.current) return;
        // Simplify vertices for Matter.js: use convex hull for reliability
        const vertices = Matter.Vertices.hull(obj.points.map(p => ({ x: p.x, y: p.y })));
        const body = Matter.Bodies.fromVertices(obj.x, obj.y, [vertices], {
          render: { fillStyle: obj.color },
          label: obj.id,
          restitution: 0.1,
          friction: 0.8,
          frictionAir: 0.05,
          density: 0.01 
        });
        
        const finalBody = body || Matter.Bodies.rectangle(obj.x, obj.y, 40, 40, {
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
      const Matter = MatterRef.current;
      if (Matter && physicsBodies.current[id] && physicsEngine.current) {
        Matter.World.remove(physicsEngine.current.world, physicsBodies.current[id]);
        delete physicsBodies.current[id];
      }
    });

    socket.on('physics-object-grabbed', ({ id, userId }: { id: string, userId: string }) => {
      setPhysicsObjects(prev => prev.map(o => o.id === id ? { ...o, heldBy: userId } : o));
      const Matter = MatterRef.current;
      const body = physicsBodies.current[id];
      if (Matter && body) {
        Matter.Body.setStatic(body, true);
      }
    });

    socket.on('physics-object-thrown', ({ id, velocity }: { id: string, velocity: { x: number, y: number } }) => {
      setPhysicsObjects(prev => prev.map(o => o.id === id ? { ...o, heldBy: null, throwsRemaining: o.throwsRemaining - 1 } : o));
      import('matter-js').then(Matter => {
        const body = physicsBodies.current[id];
        if (body) {
          Matter.Body.setStatic(body, false);
          // Stronger multiplier for more realistic throwing feel
          Matter.Body.setVelocity(body, { x: velocity.x * 2.5, y: velocity.y * 2.5 });
        }
      });
    });

    socket.on('game-reset', (usersMap: any) => {
      setHealth(100);
      setIsReady(false);
      setIsGameActive(false);
      setWinner(null);
      setCountdown(null);
      setIsBSODActive(false);
      setBsodGlitched(false);
      setIsFrozen(false);
      isFrozenRef.current = false;
      const { [socket.id as string]: self, ...others } = usersMap;
      if (currentServerRef.current === 'training') {
        others['dummy-id'] = {
          x: 500, y: 500, username: 'DUMMY [TRAINING]', health: 100, isReady: true, cursorMode: 'pointer'
        };
        setMoney(7000);
      }
      setOtherUsers(others);
    });

    socket.on('user-moved', ({ id, pos }: { id: string, pos: { x: number, y: number } }) => {
      presenceSyncRef.current[id] = Date.now();
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

    socket.on('bsod-start', ({ triggererId }: { triggererId: string }) => {
      if (socketRef.current?.id === triggererId) return;
      setIsBSODActive(true);
      setIsFrozen(true);
      isFrozenRef.current = true;
      setTimeout(() => {
        setIsFrozen(false);
        isFrozenRef.current = false;
      }, 2000);
      
      const glitchInterval = setInterval(() => {
        setBsodGlitched(true);
        setTimeout(() => setBsodGlitched(false), 80);
      }, 800);

      setTimeout(() => {
        setIsBSODActive(false);
        setBsodGlitched(false);
        clearInterval(glitchInterval);
      }, 10000);
    });

    socket.on('storm-start', ({ triggererId }: { triggererId: string }) => {
      if (socketRef.current?.id === triggererId) return;
      let count = 0;
      const totalAds = 15;
      const interval = setInterval(() => {
        const id = Math.random().toString(36).substring(7);
        const x = 10 + Math.random() * 60;
        const y = 10 + Math.random() * 60;
        const ads = [
          "WIN A NEW IPHONE!!!", 
          "YOUR PC IS INFECTED!", 
          "SINGLE MICE IN YOUR AREA", 
          "DOWNLOAD FREE RAM", 
          "CONGRATULATIONS!", 
          "URGENT SYSTEM UPDATE",
          "YOU ARE THE 1,000,000th VISITOR!",
          "CLICK HERE FOR FREE MONEY",
          "HOT CHEESE NEARBY"
        ];
        const content = ads[Math.floor(Math.random() * ads.length)];
        
        setAdPopups(prev => [...prev, { id, x, y, content }]);
        count++;
        if (count >= totalAds) clearInterval(interval);
      }, 300);
    });

    socket.on('server-item-unlocked', ({ itemId }: { itemId: string }) => {
      setServerUnlockedItems(prev => [...prev, itemId]);
    });

    const timer = setInterval(() => setTime(new Date()), 1000);
    setTimeout(() => setIsBooting(false), 2500);

    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, []); // Truly stable initialization

  // Coordinate conversion helpers
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

  // Mouse Listeners handled separately to use latest state refs
  useEffect(() => {
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
      if (isRagdollRef.current || isFrozenRef.current) return;
      const screenPos = { x: e.clientX, y: e.clientY };
      lastScreenPos.current = screenPos;
      const pos = normalize(screenPos);
      setMousePos(pos);

      if (isMouseDown.current && cursorModeRef.current === 'lasso' && !lassoStateRef.current.targetId) {
        setCurrentDrawing(prev => {
          const last = prev[prev.length - 1];
          if (!last) return [{ x: pos.x, y: pos.y }];
          const d = Math.sqrt(Math.pow(pos.x - last.x, 2) + Math.pow(pos.y - last.y, 2));
          if (d > 5) {
            const next = [...prev, { x: pos.x, y: pos.y }].slice(-100);
            if (next.length > 20) {
              const start = next[0];
              const gap = Math.sqrt((pos.x - start.x)**2 + (pos.y - start.y)**2);
              if (gap < 40) {
                 const victims: string[] = [];
                 Object.entries(otherUsersRef.current).forEach(([id, u]) => {
                   const user = u as UserState;
                   if (isPointInPoly({ x: user.x, y: user.y }, next)) victims.push(id);
                 });
                 if (victims.length > 0) {
                    const hitId = victims[0];
                    setLassoState(prev => ({ ...prev, fired: true, targetId: hitId, startTime: Date.now() }));
                    lassoTargetVelocity.current = { x: 0, y: 0 };
                    if (hitId === 'dummy-id') {
                      socketRef.current?.emit('user-effect', { userId: 'dummy-id', effect: 'ragdoll', duration: 6000 });
                    } else {
                      socketRef.current?.emit('damage-player', { targetId: hitId, damage: 0, effects: ['ragdoll'], duration: 6000 });
                    }
                    return []; 
                 }
              }
            }
            return next;
          }
          return prev;
        });
        return;
      }

      if (isMouseDown.current) {
        swipePath.current.push({...pos, t: Date.now()});
      }
      
      // Update uiMousePos as percentages to stay consistent with logical coordinate system
      setUiMousePos({
        x: pos.x / 10,
        y: pos.y / 10
      });
      
      if (cursorModeRef.current === 'lasso') {
        const speed = Math.sqrt(mouseVelocity.current.x**2 + mouseVelocity.current.y**2);
        if (isSwiping.current) {
          detectCircularMotion(pos);
        }
      }

      if (cursorModeRef.current === 'pencil' && isSwiping.current) {
        setCurrentDrawing(prev => {
          if (prev.length >= 150) return prev; // Limit reached
          const last = prev[prev.length - 1];
          if (!last) return [{ x: pos.x, y: pos.y }];
          const dist = Math.sqrt(Math.pow(pos.x - last.x, 2) + Math.pow(pos.y - last.y, 2));
          if (dist > 10) return [...prev, { x: pos.x, y: pos.y }];
          return prev;
        });
      }

      if (grabbedObjectId.current) {
        const body = physicsBodies.current[grabbedObjectId.current];
        if (body && MatterRef.current) {
          MatterRef.current.Body.setPosition(body, { x: pos.x, y: pos.y });
          socketRef.current?.emit('move-physics-object', { id: grabbedObjectId.current, pos });
        }
      }

      // Charge Mechanic logic: Only fills if speed is VERY low
      if (isSwiping.current && cursorModeRef.current === 'pointer') {
         const speed = Math.sqrt(mouseVelocity.current.x**2 + mouseVelocity.current.y**2);
         if (speed < 0.5) { // Slightly more lenient stillness
            if (chargeStartTime.current === null) {
              chargeStartTime.current = Date.now();
            } else {
              const elapsed = Date.now() - chargeStartTime.current;
              const progress = Math.min(1, elapsed / 2000); // 2 seconds to full
              setChargeProgress(progress);
              if (progress >= 1 && !isCharged.current) {
                isCharged.current = true;
                chargeLocation.current = { ...pos };
              }
            }
         } else if (!isCharged.current) {
            setChargeProgress(0);
            chargeStartTime.current = null;
         }
      }

      const vel = { x: pos.x - lastMousePos.current.x, y: pos.y - lastMousePos.current.y };
      mouseVelocity.current = vel;
      
      // Store some non-zero velocities for throwing flick
      if (Math.abs(vel.x) > 0.1 || Math.abs(vel.y) > 0.1) {
        lastVelocities.current.push({ ...vel });
        if (lastVelocities.current.length > 12) lastVelocities.current.shift();
      }
      
      lastMousePos.current = pos;

      if (socketRef.current?.connected) {
        socketRef.current.emit('mouse-move', { ...pos, mode: cursorModeRef.current });
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isRagdollRef.current || isFrozenRef.current) return;
      isMouseDown.current = true;
      swipeStartTime.current = Date.now();
      const pos = normalize({ x: e.clientX, y: e.clientY });
      
      swipePath.current = [{...pos, t: Date.now()}];
      swipeStartPos.current = pos;
      lastTrailPoint.current = pos;
      isSwiping.current = true;

      // Find what was clicked
      const target = e.target as HTMLElement;
      const isWindowOrButton = target.closest('.xp-window') || target.closest('button') || target.closest('.cursor-pointer');
      
      const fightsIcon = target.closest('[data-id="fights-exe"]');
      if ((winner || health <= 0) && fightsIcon) {
        socketRef.current?.emit('reset-game');
      }

      setIsClicked(true);
      checkAutoclicker();

      if (e.button === 0) { // LEFT CLICK
        if (cursorModeRef.current === 'pencil') {
          setCurrentDrawing([{ x: pos.x, y: pos.y }]);
        } else if (cursorModeRef.current === 'lasso') {
          const now = Date.now();
          const isCombatMode = isGameActiveRef.current || currentServerRef.current === 'training';
          if (!isCombatMode) return;
          if (cooldowns['lasso'] && now < cooldowns['lasso']) return;
          setCurrentDrawing([{ x: pos.x, y: pos.y }]);
          return;
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
          const damage = Math.min(4, Math.max(1, Math.round(sharpnessScore / 4) + 1));

          const centerX = points.reduce((acc, p) => acc + p.x, 0) / points.length;
          const centerY = points.reduce((acc, p) => acc + p.y, 0) / points.length;

          const newObj: PhysicsObject = {
            id: Math.random().toString(),
            points,
            x: centerX,
            y: centerY,
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
      if (isWindowOrButton && !target.closest('#desktop-canvas')) {
        // Just UI interaction
      } else if (cursorModeRef.current === 'pointer' && (isGameActiveRef.current || currentServerRef.current === 'training')) {
          Object.entries(otherUsersRef.current).forEach(([id, user]) => {
            const u = user as UserState;
            const dist = Math.sqrt(Math.pow(pos.x - u.x, 2) + Math.pow(pos.y - u.y, 2));
            if (dist < 70) { 
              if (id === 'dummy-id') {
                setOtherUsers(prev => ({
                  ...prev,
                  ['dummy-id']: { ...prev['dummy-id'], health: Math.max(0, prev['dummy-id'].health - 4) }
                }));
              } else {
                socketRef.current?.emit('damage-player', { targetId: id, damage: 4 });
              }
            }
          });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const screenPos = { x: e.clientX, y: e.clientY };
      const pos = normalize(screenPos);
      isMouseDown.current = false;
      setIsClicked(false);
      
      if (cursorModeRef.current === 'lasso' && currentDrawingRef.current.length > 5) {
        const points = currentDrawingRef.current;
        const start = points[0];
        const end = points[points.length - 1];
        const dist = Math.sqrt(Math.pow(start.x - end.x, 2) + Math.pow(start.y - end.y, 2));
        
        if (lassoStateRef.current.targetId) {
            // FLING ON RELEASE
            const targetId = lassoStateRef.current.targetId;
            const targetBodyId = `player-ragdoll-${targetId}`;
            const targetBody = physicsBodies.current[targetBodyId];
            
            if (targetBody && MatterRef.current) {
                const Matter = MatterRef.current;
                // Apply momentum to fling
                const velX = targetBody.velocity.x * 2.5;
                const velY = targetBody.velocity.y * 2.5;
                Matter.Body.setVelocity(targetBody, { x: velX, y: velY });
            }

            setLassoState(prev => ({ ...prev, fired: false, targetId: null }));
        } else if (dist < 100) { 
          const victims: string[] = [];
          Object.entries(otherUsersRef.current).forEach(([id, u]) => {
            const user = u as any;
            if (isPointInPoly({ x: user.x, y: user.y }, points)) {
              victims.push(id);
            }
          });

          if (victims.length > 0) {
            const hitId = victims[0];
            setLassoState(prev => ({ ...prev, fired: true, targetId: hitId, startTime: Date.now() }));
            lassoTargetVelocity.current = { x: 0, y: 0 };
            
            // Locally set ragdoll state for immediate feedback
            setOtherUsers(prev => {
              if (prev[hitId]) return { ...prev, [hitId]: { ...prev[hitId], isRagdoll: true } };
              return prev;
            });

            const center = {
              x: points.reduce((a, b) => a + b.x, 0) / points.length,
              y: points.reduce((a, b) => a + b.y, 0) / points.length
            };
            setLassoContraction({ points, victims, center });
            setTimeout(() => setLassoContraction(null), 800);

            if (hitId === 'dummy-id') {
              socketRef.current?.emit('user-effect', { userId: 'dummy-id', effect: 'ragdoll', duration: 6000 });
            } else {
              socketRef.current?.emit('damage-player', { targetId: hitId, damage: 0, effects: ['ragdoll'], duration: 6000 });
            }
          }
        }
        setCurrentDrawing([]);
        return;
      }

      const swipeDuration = Date.now() - swipeStartTime.current;
      const swipeDist = Math.sqrt(Math.pow(pos.x - swipeStartPos.current.x, 2) + Math.pow(pos.y - swipeStartPos.current.y, 2));
      const now = Date.now();
      
      const isCombatMode = isGameActiveRef.current || currentServerRef.current === 'training';

      // 1. FAST SWIPE ATTACK (Pointer mode only)
      if (isSwiping.current && cursorModeRef.current === 'pointer' && isCombatMode) {
        if (swipeDuration >= 140 && swipeDuration <= 400 && swipeDist > 120 && stamina >= 25 && now - lastSwipeTime > 400) {
          const from = swipeStartPos.current;
          const to = pos;
          const swipeId = Math.random().toString();
          
          setStamina(prev => prev - 25);
          setLastSwipeTime(now);
          
          socketRef.current?.emit('swipe-attack', { from, to });
          setSwipes(prev => [...prev, { id: swipeId, attackerId: socketRef.current?.id || '', from, to, color: '#ffffff' }]);
          setTimeout(() => setSwipes(prev => prev.filter(s => s.id !== swipeId)), 300);

          setScreenShake(true);
          setTimeout(() => setScreenShake(false), 200);

          Object.entries(otherUsersRef.current).forEach(([id, user]) => {
            const u = user as UserState;
            if (u.health <= 0) return;
            
            const dist = lineToPointDistance(from, to, { x: u.x, y: u.y });
            const p = { x: u.x, y: u.y };
            const segmentDist = lineDist(from, to);
            if (dist < 80 && (lineDist(from, p) < segmentDist + 40 && lineDist(to, p) < segmentDist + 40)) {
               const sparkId = Math.random().toString();
               setHitSparks(prev => [...prev, { id: sparkId, x: u.x, y: u.y }]);
               setTimeout(() => setHitSparks(prev => prev.filter(s => s.id !== sparkId)), 500);

               if (id === 'dummy-id') {
                 setOtherUsers(prev => ({
                   ...prev,
                   ['dummy-id']: { ...prev['dummy-id'], health: Math.max(0, prev['dummy-id'].health - 6) }
                 }));
               } else {
                 socketRef.current?.emit('damage-player', { targetId: id, damage: 6 });
               }
            }
          });
        }
      }

      // 2. LASSO RELEASE
      if (isSwiping.current && cursorModeRef.current === 'lasso' && lassoStateRef.current.active && !lassoStateRef.current.fired && isCombatMode) {
          const firePos = { ...pos };
          let hitId: string | null = null;
          
          Object.entries(otherUsersRef.current).forEach(([uid, user]) => {
            const u = user as UserState;
            const dist = Math.sqrt(Math.pow(u.x - firePos.x, 2) + Math.pow(u.y - firePos.y, 2));
            if (dist < 350) hitId = uid; 
          });

          if (hitId) {
            setLassoState(prev => ({ ...prev, fired: true, targetId: hitId, startTime: Date.now() }));
            if (hitId === 'dummy-id') {
              socketRef.current?.emit('user-effect', { userId: 'dummy-id', effect: 'ragdoll', duration: 6000 });
            } else {
              socketRef.current?.emit('damage-player', { targetId: hitId, damage: 0, effects: ['ragdoll'], duration: 6000 });
            }
          } else {
            setLassoState({ active: false, swingAngle: 0, fired: false, targetId: null, startTime: 0, ropePoints: [] });
          }
      }
        
      // 3. PENCIL OBJECT CREATION
      if (cursorModeRef.current === 'pencil' && currentDrawingRef.current.length > 2) {
        const points = [...currentDrawingRef.current];
        points.push({ ...points[0] });
        const centerX = points.reduce((acc, p) => acc + p.x, 0) / points.length;
        const centerY = points.reduce((acc, p) => acc + p.y, 0) / points.length;
        const relPoints = points.map(p => ({ x: p.x - centerX, y: p.y - centerY }));

        const newObj: PhysicsObject = {
          id: Math.random().toString(),
          points: relPoints,
          x: centerX,
          y: centerY,
          angle: 0,
          color: `hsl(${Math.random() * 360}, 70%, 60%)`,
          creatorId: socketRef.current?.id || '',
          heldBy: null,
          throwsRemaining: 2,
          createdAt: Date.now(),
          damage: 3
        };
        socketRef.current?.emit('add-physics-object', newObj);
        setCurrentDrawing([]);
      }

      // 4. CHARGED SWIPE (Old mechanic preserved)
      if (isCharged.current && cursorModeRef.current === 'pointer') {
        const from = chargeLocation.current;
        const to = pos;
        const dist = Math.sqrt((to.x - from.x)**2 + (to.y - from.y)**2);

        if (dist > 30) {
          const swipeId = Math.random().toString();
          socketRef.current?.emit('swipe-attack', { from, to, isCharged: true });
          setSwipes(prev => [...prev, { id: swipeId, attackerId: socketRef.current?.id || '', from, to, color: '#facc15' }]);
          setTimeout(() => setSwipes(prev => prev.filter(s => s.id !== swipeId)), 2500);

          if (isCombatMode) {
            Object.entries(otherUsersRef.current).forEach(([id, user]) => {
              const u = user as UserState;
              const d = lineToPointDistance(from, to, { x: u.x, y: u.y });
              if (d < 60) {
                if (id === 'dummy-id') {
                  setOtherUsers(prev => ({
                    ...prev,
                    ['dummy-id']: { ...prev['dummy-id'], health: Math.max(0, prev['dummy-id'].health - 4) }
                  }));
                } else {
                  socketRef.current?.emit('damage-player', { targetId: id, damage: 4 });
                }
              }
            });
          }
        }
      }

      // 5. PHYSICS GRAB RELEASE
      if (grabbedObjectId.current) {
        const activeVels = lastVelocities.current;
        const avgVel = activeVels.reduce((acc, v) => ({
          x: acc.x + v.x,
          y: acc.y + v.y
        }), { x: 0, y: 0 });
        const count = activeVels.length || 1;
        const vel = { x: (avgVel.x / count) * 6, y: (avgVel.y / count) * 6 };
        
        socketRef.current?.emit('throw-physics-object', { id: grabbedObjectId.current, velocity: vel });
        lastVelocities.current = [];
        grabbedObjectId.current = null;
      }

      // Cleanup
      isSwiping.current = false;
      setIsClicked(false);
      lastSwipeTick.current = 0;
      setChargeProgress(0);
      chargeStartTime.current = null;
      isCharged.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      // Ignore if scrolling inside a window 
      const target = e.target as HTMLElement;
      if (target.closest('.xp-window')) return;

      scrollAccumulator.current += e.deltaY;
      if (Math.abs(scrollAccumulator.current) > 120) {
        const direction = scrollAccumulator.current > 0 ? 1 : -1;
        scrollAccumulator.current = 0;
        setCursorMode(prev => {
          const modes = [...unlockedModesRef.current, ...serverUnlockedItemsRef.current].filter(m => !m.includes('bsod') && !m.includes('storm'));
          const idx = modes.indexOf(prev);
          const next = modes[(idx + direction + modes.length) % modes.length];
          setShowModeSwitch(true);
          // @ts-ignore
          if (window._modeTimeout) clearTimeout(window._modeTimeout);
          // @ts-ignore
          window._modeTimeout = setTimeout(() => setShowModeSwitch(false), 2000);
          return next;
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCombatMode = isGameActiveRef.current || currentServerRef.current === 'training';
      
      if (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'c') {
        if (isCombatMode) {
          setIsWheelOpen(true);
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setCursorMode(prev => {
          const modes = [...unlockedModesRef.current, ...serverUnlockedItemsRef.current].filter(m => !m.includes('bsod') && !m.includes('storm'));
          const idx = modes.indexOf(prev);
          const next = modes[(idx + 1) % modes.length];
          setShowModeSwitch(true);
          // @ts-ignore
          if (window._modeTimeout) clearTimeout(window._modeTimeout);
          // @ts-ignore
          window._modeTimeout = setTimeout(() => setShowModeSwitch(false), 2000);
          return next;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'c') {
        if (isWheelOpenRef.current) {
          if (wheelSelectionRef.current) {
            const now = Date.now();
            const selection = wheelSelectionRef.current;
            if (selection === 'lasso') {
              setCursorMode('lasso');
            } else if (selection === 'bsod') {
              if (!cooldownsRef.current['bsod'] || now >= cooldownsRef.current['bsod']) {
                socketRef.current?.emit('bsod-trigger');
                setCooldowns(prev => ({ ...prev, bsod: now + 45000 }));
              }
            } else if (selection === 'storm') {
              if (!cooldownsRef.current['storm'] || now >= cooldownsRef.current['storm']) {
                socketRef.current?.emit('storm-trigger');
                setCooldowns(prev => ({ ...prev, storm: now + 30000 }));
              }
            }
          }
          setIsWheelOpen(false);
          setWheelSelection(null);
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY, button: 0, target: touch.target, preventDefault: () => {} } as any);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as any);
      if (e.cancelable) e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      handleMouseUp({ clientX: lastScreenPos.current.x, clientY: lastScreenPos.current.y, button: 0 } as any);
    };

    eventRef.current = { handleMouseMove, handleMouseDown, handleMouseUp, handleWheel, handleKeyDown, handleKeyUp, handleTouchStart, handleTouchMove, handleTouchEnd };

    // Exposure for mobile buttons
    // @ts-ignore
    window._finishPencilDrawing = () => {
       eventRef.current.handleMouseUp({ clientX: 0, clientY: 0, button: 2 } as any);
    };

    const wrapMouseMove = (e: any) => eventRef.current.handleMouseMove(e);
    const wrapMouseDown = (e: any) => eventRef.current.handleMouseDown(e);
    const wrapMouseUp = (e: any) => eventRef.current.handleMouseUp(e);
    const wrapTouchStart = (e: any) => eventRef.current.handleTouchStart(e);
    const wrapTouchMove = (e: any) => eventRef.current.handleTouchMove(e);
    const wrapTouchEnd = (e: any) => eventRef.current.handleTouchEnd(e);
    const wrapWheel = (e: any) => eventRef.current.handleWheel(e);
    const wrapKeyDown = (e: any) => eventRef.current.handleKeyDown(e);
    const wrapKeyUp = (e: any) => eventRef.current.handleKeyUp(e);

    window.addEventListener('mousemove', wrapMouseMove);
    window.addEventListener('mousedown', wrapMouseDown);
    window.addEventListener('mouseup', wrapMouseUp);
    window.addEventListener('touchstart', wrapTouchStart, { passive: false });
    window.addEventListener('touchmove', wrapTouchMove, { passive: false });
    window.addEventListener('touchend', wrapTouchEnd, { passive: false });
    window.addEventListener('wheel', wrapWheel);
    window.addEventListener('keydown', wrapKeyDown);
    window.addEventListener('keyup', wrapKeyUp);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    
    return () => {
      window.removeEventListener('mousemove', wrapMouseMove);
      window.removeEventListener('mousedown', wrapMouseDown);
      window.removeEventListener('mouseup', wrapMouseUp);
      window.removeEventListener('touchstart', wrapTouchStart);
      window.removeEventListener('touchmove', wrapTouchMove);
      window.removeEventListener('touchend', wrapTouchEnd);
      window.removeEventListener('wheel', wrapWheel);
      window.removeEventListener('keydown', wrapKeyDown);
      window.removeEventListener('keyup', wrapKeyUp);
      window.removeEventListener('contextmenu', (e) => e.preventDefault());
    };
  }, []); // Truly stable event handlers
  const shopItems = [
    { id: 'storm', name: 'Pop-up Ad Storm', priceServer: 30, pricePersonal: 100, icon: 'https://img.icons8.com/color/96/commercial.png', desc: 'Release a chaotic storm of ads on everyone\'s screen.' },
    { id: 'bsod', name: 'Global BSOD', priceServer: 50, pricePersonal: 150, icon: '/BSOD.png', desc: 'Freeze the server for 2s, followed by a 10s BSOD effect.' },
    { id: 'lasso', name: 'Lasso.sh', priceServer: 40, pricePersonal: 120, icon: '/Lasso head.png', desc: 'Draw a circle around players to ragdoll them.' },
  ];

  const buyItem = (itemId: string, type: 'personal' | 'server') => {
    const isTraining = currentServerRef.current === 'training';
    const item = shopItems.find(i => i.id === itemId);
    if (!item) return;
    
    const price = type === 'personal' ? item.pricePersonal : item.priceServer;
    
    if ((isTraining || money >= price)) {
      if (!isTraining) setMoney(m => m - price);
      
      const fullId = type === 'personal' ? `${itemId}-personal` : `${itemId}-server`;
      
      if (type === 'server') {
        socketRef.current?.emit('buy-server-item', { itemId: fullId });
      } else {
        setUnlockedModes(prev => [...prev, fullId]);
      }
      setSelectedShopItemId(null);
    }
  };

  const lineDist = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
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

  const [isMobile, setIsMobile] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [containerScale, setContainerScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches || ('ontouchstart' in window));
      
      if (!containerRef.current) return;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      
      // Standard "PC" resolution we want to simulate
      const targetW = 1200;
      const targetH = 900; 
      
      const scaleW = winW / targetW;
      const scaleH = winH / targetH;
      
      // Use the smaller scale to ensure it fits entirely
      const newScale = Math.min(scaleW, scaleH);
      setContainerScale(newScale);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`h-screen w-screen bg-[#1a1a1a] flex items-center justify-center overflow-hidden transition-all duration-300 ${isFullScreen ? 'p-0' : 'p-2 md:p-4'}`}
    >
      {/* Cooldown Indicators */}
      <div className="fixed top-2 right-20 z-[200] flex gap-2 pointer-events-none">
        {Object.entries(cooldowns).map(([id, time]) => {
          const remaining = Math.max(0, Math.ceil(((time as number) - Date.now()) / 1000));
          if (remaining <= 0) return null;
          return (
            <div key={id} className="bg-black/60 text-white text-[10px] px-2 py-1 rounded border border-white/20 pixel-text animate-pulse">
              {id.toUpperCase()}: {remaining}s
            </div>
          );
        })}
      </div>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ 
          scale: isFullScreen ? 1 : containerScale, 
          opacity: 1,
          width: isFullScreen ? '100vw' : '1200px',
          height: isFullScreen ? '100vh' : '900px'
        }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className={`relative bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)] ${isFullScreen ? 'border-0 rounded-none' : 'border-8 border-gray-900 rounded-xl'} overflow-hidden origin-center`}
      >
        <motion.div 
          ref={desktopRef}
          id="desktop-canvas"
          className="relative h-full w-full bg-[#3a6ea5] select-none font-sans overflow-hidden touch-none"
          animate={screenShake ? {
             x: [0, -5, 5, -5, 5, 0],
             y: [0, 5, -5, 5, -5, 0]
          } : { x: 0, y: 0 }}
          transition={{ duration: 0.2, ease: "linear" }}
        >
          {/* Windows XP Logo in background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none select-none">
            <img src="/windows-xp.webp" className="w-[60vw] max-w-[600px] object-contain" alt="Windows XP" onError={(e) => (e.target as any).style.display='none'} />
          </div>

            {lassoState.targetId && (otherUsers[lassoState.targetId] || (lassoState.targetId === 'dummy-id' && otherUsers['dummy-id'])) && (
              <LassoRope 
                from={mousePos} 
                to={lassoState.targetId === 'dummy-id' ? otherUsers['dummy-id'] : otherUsers[lassoState.targetId]} 
              />
            )}

            {/* Lasso Drawing Visual */}
            {isMouseDown.current && cursorMode === 'lasso' && currentDrawing.length > 1 && (
               <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1000]" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                  <path 
                    d={`M ${currentDrawing.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                    fill="rgba(217, 119, 6, 0.1)"
                    stroke="#d97706"
                    strokeWidth="3"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx={currentDrawing[0].x} cy={currentDrawing[0].y} r="8" fill="none" stroke="#d97706" />
               </svg>
            )}

            {/* Lasso Contraction Visual */}
            {lassoContraction && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1000]" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                <motion.path 
                  initial={{ pathLength: 1, scale: 1, opacity: 1 }}
                  animate={{ scale: 0.1, opacity: 0 }}
                  transition={{ duration: 0.8, ease: "circIn" }}
                  style={{ 
                    originX: `${lassoContraction.center.x}px`, 
                    originY: `${lassoContraction.center.y}px`,
                    transformBox: 'fill-box'
                  }}
                  d={`M ${lassoContraction.points.map(p => `${p.x} ${p.y}`).join(' L ')} Z`}
                  fill="rgba(217, 119, 6, 0.3)"
                  stroke="#d97706"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Ropes from mouse to victims (UI mouse is 0-100, we need 0-1000) */}
                {lassoContraction.victims.map(vid => {
                   const v = otherUsers[vid] || (otherUsersRef.current[vid] as any);
                   if (!v) return null;
                   return (
                     <LassoRope 
                       key={vid}
                       from={mousePos}
                       to={{ x: v.x, y: v.y }}
                     />
                   );
                })}
              </svg>
            )}
        <AnimatePresence>
          {isBooting ? (
            <motion.div 
              key="boot"
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[1000] bg-black pointer-events-none flex flex-col items-center justify-center"
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
          ) : !currentUser ? (
            <motion.div 
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[900] bg-[#5a7edc] flex flex-col items-center justify-center overflow-hidden"
            >
              {/* Background gradient design like XP login */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#1a44a1] via-[#5a7edc] to-[#1a44a1] opacity-50" />
              <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-[#00000044] to-transparent" />
              <div className="absolute bottom-0 left-0 w-full h-[50%] bg-gradient-to-t from-[#00000044] to-transparent" />
              
              <div className="relative z-10 w-full max-w-4xl flex items-center">
                 <div className="flex-1 flex flex-col items-end pr-10 border-r-2 border-white/20 py-10">
                    <div className="flex items-center gap-4 mb-4">
                       <img src="/XPIcon.webp" className="w-24 h-24 pixelated drop-shadow-xl" alt="XP" />
                    </div>
                    <h1 className="text-white text-4xl font-light tracking-tight italic">Windows <span className="font-bold not-italic">XP</span></h1>
                    <p className="text-white/60 text-sm mt-2">Professional Edition</p>
                 </div>
                 
                 <div className="flex-1 pl-10 flex flex-col gap-6">
                    <h2 className="text-white text-xl mb-4">To begin, click your user name</h2>
                    
                    <button 
                      onClick={handleLogin}
                      className="group flex items-center gap-4 p-2 rounded-lg hover:bg-white/10 transition-all text-left"
                    >
                       <div className="w-16 h-16 rounded border-2 border-white bg-blue-400 overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                          <User className="w-full h-full text-white/50 p-2" />
                       </div>
                       <div>
                          <p className="text-white text-2xl font-medium group-hover:text-amber-400 transition-colors">Login with Google</p>
                          <p className="text-white/60 text-sm">Save your data & money</p>
                       </div>
                    </button>

                    <button 
                      onClick={() => setCurrentUser({ displayName: 'Guest', uid: 'guest-' + Math.random() } as any)}
                      className="group flex items-center gap-4 p-2 rounded-lg hover:bg-white/10 transition-all text-left opacity-60 hover:opacity-100"
                    >
                       <div className="w-12 h-12 rounded border border-white/50 bg-gray-400 overflow-hidden group-hover:scale-105 transition-transform">
                          <LogIn className="w-full h-full text-white/50 p-2" />
                       </div>
                       <div>
                          <p className="text-white text-lg font-medium group-hover:text-blue-200">Play as Guest</p>
                          <p className="text-white/40 text-[10px]">Data will not be saved</p>
                       </div>
                    </button>
                 </div>
              </div>

              <div className="absolute bottom-10 left-10 flex flex-col gap-4">
                 <button className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center border border-white/20">
                       <Monitor size={16} />
                    </div>
                    <span className="text-sm">Turn off computer</span>
                 </button>
              </div>
            </motion.div>
          ) : null}
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

        {/* Lasso Layer */}
        {cursorMode === 'lasso' && lassoState.active && (
          <div className="absolute inset-0 pointer-events-none z-[16] overflow-hidden">
             <svg className="w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                <motion.path
                  d={(() => {
                    const radius = 60;
                    const segments = 20;
                    const points = [];
                    for(let i = 0; i <= segments; i++) {
                      const angle = (i / segments) * Math.PI * 2 + (lassoState.swingAngle * Math.PI / 180);
                      const x = mousePos.x + Math.cos(angle) * (lassoState.fired ? 200 * (Math.min(1, (Date.now() - lassoState.startTime)/500)) : radius);
                      const y = mousePos.y + Math.sin(angle) * (lassoState.fired ? 200 * (Math.min(1, (Date.now() - lassoState.startTime)/500)) : radius);
                      points.push(`${x},${y}`);
                    }
                    // Add line from mouse to loop
                    return `M ${mousePos.x},${mousePos.y} L ${points[0]} M ${points.join(' L ')}`;
                  })()}
                  stroke="#8b4513"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />
                {lassoState.fired && lassoState.targetId && otherUsers[lassoState.targetId] && (
                   <line 
                     x1={mousePos.x} y1={mousePos.y} 
                     x2={otherUsers[lassoState.targetId].x} y2={otherUsers[lassoState.targetId].y} 
                     stroke="#8b4513" 
                     strokeWidth="4"
                     strokeDasharray="10 5"
                   />
                )}
             </svg>
          </div>
        )}

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
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0, scaleY: 0.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                />
              ))}
              {hitSparks.map(spark => (
                <motion.circle
                  key={spark.id}
                  cx={spark.x}
                  cy={spark.y}
                  r={10}
                  fill="#ffdb4d"
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: [1, 2, 0], opacity: 0 }}
                  transition={{ duration: 0.4 }}
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
        <div className="absolute inset-0 pointer-events-none z-[15] overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
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
            onClick={() => toggleWindow('explorer-exe', true)}
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
          {windows.map(win => {
            const fightsOpen = windows.find(w => w.id === 'fights-exe')?.isOpen;
            // Privatize windows: only shared during active combat or if specifically Fights.exe is active
            const isVisible = win.isOpen && (
              win.openedBy === socketRef.current?.id || 
              isGameActive ||
              (win.id === 'fights-exe' && fightsOpen)
            );
            
            if (!isVisible) return null;

            return (
              <motion.div
                key={win.id}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1, 
                  left: `${((win.x as number) / 1000) * 100}%`, 
                  top: `${((win.y as number) / 1000) * 100}%`,
                  width: win.width,
                  height: win.height
                }}
                exit={{ scale: 0.95, opacity: 0 }}
                drag={!win.draggedBy || win.draggedBy === socketRef.current?.id}
                dragMomentum={false}
                dragConstraints={desktopRef}
                onDragStart={(e, info) => handleDragWindowStart(win.id, info)}
                onDrag={(e, info) => handleDragWindowMove(win.id, info)}
                onDragEnd={() => handleDragWindowEnd(win.id)}
                className={`absolute z-20 xp-window xp-pixelated-window overflow-hidden flex flex-col ${win.draggedBy && win.draggedBy !== socketRef.current?.id ? 'opacity-70 pointer-events-none' : ''}`}
                style={{ 
                  boxShadow: win.draggedBy ? '0 20px 40px rgba(0,0,0,0.4)' : '0 10px 20px rgba(0,0,0,0.2)'
                }}
              >
                <div className="xp-window-header cursor-move">
                  <div className="xp-window-title pixel-text text-[9px] uppercase tracking-tighter">
                    {win.id === 'my-computer' && <Monitor size={14} className="pixel-icon" />}
                    {win.id === 'server-join' && <Link size={14} className="pixel-icon" />}
                    {win.id === 'fights-exe' && <Swords size={14} className="pixel-icon" />}
                    {win.id === 'explorer-exe' && <Folder size={14} className="pixel-icon" />}
                    {win.id === 'browser-exe' && <Chrome size={14} className="pixel-icon" />}
                    <span>{win.title} {win.draggedBy && win.draggedBy !== socketRef.current?.id && "(DRAGGED BY OTHER)"}</span>
                  </div>
                  <div className="xp-window-controls" onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => toggleWindow(win.id, false)} className="xp-control-button bg-[#3d95ff] border border-white/50 w-5 h-5 flex items-center justify-center"><Minimize2 size={10} /></button>
                    <button className="xp-control-button bg-[#3d95ff] border border-white/50 w-5 h-5 flex items-center justify-center"><Square size={8} /></button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (win.id === 'fights-exe' && isGameActive) return;
                        toggleWindow(win.id, false);
                      }}
                      className={`xp-control-button ${isGameActive && win.id === 'fights-exe' ? 'bg-gray-500 opacity-50 cursor-not-allowed' : 'bg-[#e91010] active:bg-[#c00]'} border border-white/50 w-5 h-5 flex items-center justify-center`}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-4 bg-white m-0.5 overflow-auto border-t border-gray-400 relative">
                  {win.id === 'browser-exe' && (
                    <div className="flex flex-col h-full">
                       <div className="flex items-center gap-2 bg-[#ece9d8] p-1 border-b border-gray-400">
                          <div className="flex gap-1">
                             <button className="w-6 h-6 border border-gray-400 flex items-center justify-center opacity-50"><Link size={12} /></button>
                             <button className="w-6 h-6 border border-gray-400 flex items-center justify-center opacity-50"><Link size={12} className="rotate-180" /></button>
                          </div>
                          <div className="flex-1 bg-white border border-gray-400 px-2 py-0.5 text-[10px] flex items-center gap-2">
                             <Chrome size={10} className="text-blue-500" />
                             <span>http://www.google.com</span>
                          </div>
                       </div>
                       <div className="flex-1 bg-white flex flex-col items-center justify-center p-8">
                          <img src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png" className="w-48 mb-8" alt="Google" />
                          <div className="w-full max-w-sm">
                             <div className="flex gap-2 mb-4">
                               <input type="text" className="flex-1 border border-gray-400 p-1.5 shadow-inner" />
                               <button className="bg-[#f2f2f2] border border-gray-300 px-4 py-1 text-xs hover:border-gray-400">Google Search</button>
                             </div>
                             <div className="flex items-center justify-center gap-4 text-[11px] text-blue-700 underline">
                                <span>Images</span>
                                <span>Maps</span>
                                <span>News</span>
                                <span>Gmail</span>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}

                  {win.id === 'explorer-exe' && (
                    <div className="flex flex-col h-full bg-[#f1f1f1]">
                      <div className="flex gap-4 p-2 border-b border-white bg-gradient-to-r from-blue-100 to-blue-50">
                        <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => {}}>
                           <Folder className="text-yellow-500 fill-yellow-200" size={32} />
                           <span className="text-[10px]">Folder</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => {}}>
                           <HardDrive className="text-gray-500" size={32} />
                           <span className="text-[10px]">Disk C:</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => {}}>
                           <Info className="text-blue-500" size={32} />
                           <span className="text-[10px]">README.txt</span>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-5 gap-4">
                        {[1,2,3,4,5,6].map(i => (
                          <div key={i} className="flex flex-col items-center gap-1 hover:bg-blue-100 p-2 rounded cursor-pointer group">
                             <Folder className="text-yellow-400 fill-yellow-100 group-hover:scale-105 transition-transform" size={40} />
                             <span className="text-[10px] text-center line-clamp-1">New Folder ({i})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {win.id === 'shop-exe' ? (
                    <div className="h-full flex flex-col bg-[#ece9d8] text-black border-2 border-[#808080] border-t-[#dfdfdf] border-l-[#dfdfdf]">
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[#808080]">
                           <div className="w-16 h-16 bg-white border-2 border-[#808080] border-t-[#000] border-l-[#000] flex items-center justify-center">
                              <Swords className="text-red-600" size={32} />
                           </div>
                           <div>
                              <h3 className="text-xl font-bold text-[#003399] tracking-tighter" style={{ fontFamily: 'Tahoma, sans-serif' }}>SHOP.EXE - MARKET</h3>
                              <p className="text-xs text-[#003399]/60 font-bold uppercase tracking-widest">Select an attack to license</p>
                           </div>
                           <div className="ml-auto text-right">
                              <p className="text-[10px] font-bold text-gray-500 uppercase">FUNDS</p>
                              <p className="text-lg font-black text-[#008000] leading-none">${money}</p>
                           </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          {shopItems.map(item => (
                            <div key={item.id} className="bg-[#f0f0f0] border-2 border-[#ece9d8] border-r-[#808080] border-b-[#808080] p-1">
                              <div className={`p-2 flex items-center gap-3 transition-colors ${selectedShopItemId === item.id ? 'bg-[#316ac5] text-white' : 'hover:bg-[#dfdfdf]'}`}>
                                <div className="w-10 h-10 bg-white border border-[#808080] flex items-center justify-center p-1">
                                  <img src={item.icon} className="w-full h-full pixelated object-contain" alt={item.name} />
                                </div>
                                <div className="flex-1 min-w-0" onClick={() => setSelectedShopItemId(selectedShopItemId === item.id ? null : item.id)}>
                                  <h4 className="font-bold text-xs uppercase truncate leading-tight">{item.name}</h4>
                                  <p className={`text-[9px] leading-tight line-clamp-1 ${selectedShopItemId === item.id ? 'text-white/80' : 'text-gray-600'}`}>{item.desc}</p>
                                </div>
                                <button 
                                  onClick={() => setSelectedShopItemId(selectedShopItemId === item.id ? null : item.id)}
                                  disabled={unlockedModes.includes(`${item.id}-personal`) || serverUnlockedItems.includes(`${item.id}-server`)}
                                  className="xp-button min-w-[70px] h-7 text-[9px] font-bold"
                                >
                                  {unlockedModes.includes(`${item.id}-personal`) || serverUnlockedItems.includes(`${item.id}-server`) ? 'OWNED' : 'BUY'}
                                </button>
                              </div>
                              
                              <AnimatePresence>
                                {selectedShopItemId === item.id && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0 }}
                                    className="px-2 pt-1 pb-2 overflow-hidden bg-white/30 border-t border-[#808080]/30"
                                  >
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => buyItem(item.id, 'server')}
                                        disabled={money < item.priceServer}
                                        className="flex-1 bg-[#dfdfdf] border-2 border-white border-r-[#808080] border-b-[#808080] py-1 text-[9px] font-bold uppercase active:border-[#808080] active:border-r-white active:border-b-white disabled:opacity-50"
                                      >
                                        SERVER ($ {item.priceServer})
                                      </button>
                                      <button 
                                        onClick={() => buyItem(item.id, 'personal')}
                                        disabled={money < item.pricePersonal}
                                        className="flex-1 bg-[#dfdfdf] border-2 border-white border-r-[#808080] border-b-[#808080] py-1 text-[9px] font-bold uppercase active:border-[#808080] active:border-r-white active:border-b-white disabled:opacity-50"
                                      >
                                        PERSONAL ($ {item.pricePersonal})
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : win.id === 'my-computer' && (
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

                  {win.id === 'server-join' && (
                    <div className="flex flex-col gap-4 p-4 bg-[#ece9d8]">
                      <div className="text-[11px] leading-tight text-gray-700 bg-white/50 p-2 border border-blue-200">
                        <b>XP WORLD PERSISTENCE:</b> Your username is saved to your browser. You can change it below.
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold block mb-1 uppercase tracking-tight text-gray-600">Identity:</label>
                        <div className="flex gap-2 items-center">
                          <User size={16} className="text-[#0054e3]" />
                          <input 
                            type="text" 
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value.slice(0, 15))}
                            placeholder="Your name..."
                            className="flex-1 border-2 border-gray-400 p-1 px-2 text-sm focus:outline-none focus:border-blue-600 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold block mb-1 uppercase tracking-tight text-gray-600">Server Instance:</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={serverInput}
                            onChange={(e) => setServerInput(e.target.value)}
                            placeholder="e.g. public"
                            className="flex-1 border-2 border-gray-400 p-1 px-2 text-sm focus:outline-none focus:border-blue-600 bg-white"
                          />
                        </div>
                        <div className="flex gap-1 mt-1">
                          {['public', 'training'].map(srv => (
                            <button 
                              key={srv}
                              onClick={() => setServerInput(srv)}
                              className="px-2 py-0.5 text-[9px] bg-white border border-gray-400 hover:bg-gray-100 uppercase"
                            >
                              {srv}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-2 border-t border-gray-300 pt-3">
                         <div className="flex flex-col">
                           <span className="text-[9px] uppercase font-bold text-gray-500">Player Status</span>
                           <span className={`text-[10px] ${isConnected ? 'text-green-600' : 'text-red-500'} font-bold`}>
                             {isConnected ? '• CONNECTED' : '• DISCONNECTED'}
                           </span>
                         </div>
                         <div className="flex gap-2">
                            {isConnected && (
                              <button 
                                onClick={() => {
                                  socketRef.current?.disconnect();
                                  setIsConnected(false);
                                }}
                                className="bg-red-50 border-2 border-red-600 px-3 py-1 text-[10px] font-bold text-red-700 hover:bg-red-100 shadow-[inset_-1px_-1px_1px_rgba(0,0,0,0.1)]"
                              >
                                DISCONNECT
                              </button>
                            )}
                            <button 
                              onClick={() => handleJoinServer(serverInput, usernameInput)}
                              className="bg-[#3fb03f] border-2 border-[#1b4b1b] px-4 py-1 text-white text-[11px] font-bold hover:bg-[#48c948] shadow-[inset_-1px_-1px_1px_rgba(0,0,0,0.3)] active:shadow-none"
                            >
                              SYNC & JOIN
                            </button>
                         </div>
                      </div>
                    </div>
                  )}

                  {win.id === 'fights-exe' && (
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
                            stamina={stamina}
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
                  className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-[30] group/resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = win.width;
                    const startHeight = win.height;

                    const onPointerMove = (moveEvent: PointerEvent) => {
                      const newWidth = Math.max(300, startWidth + (moveEvent.clientX - startX));
                      const newHeight = Math.max(250, startHeight + (moveEvent.clientY - startY));
                      handleResizeWindow(win.id, newWidth, newHeight);
                    };

                    const onPointerUp = () => {
                      window.removeEventListener('pointermove', onPointerMove as any);
                      window.removeEventListener('pointerup', onPointerUp as any);
                    };

                    window.addEventListener('pointermove', onPointerMove as any);
                    window.addEventListener('pointerup', onPointerUp as any);
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
        {/* Ability Bar - REMOVED per user request for Wheel */}

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

          <div className="flex-1 flex px-2 gap-1 overflow-hidden">
            {isMobile && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsWheelOpen(true)}
                  className="h-8 px-2 bg-yellow-500 border-2 border-yellow-700 text-black font-bold text-[10px] uppercase shadow-sm active:translate-y-0.5 transition-transform"
                >
                  Abilities
                </button>
                <button 
                  onClick={() => {
                    const modes = [...unlockedModesRef.current, ...serverUnlockedItemsRef.current].filter(m => !m.includes('bsod') && !m.includes('storm'));
                    setCursorMode(prev => {
                      const idx = modes.indexOf(prev);
                      return modes[(idx + 1) % modes.length];
                    });
                  }}
                  className="h-8 px-2 bg-blue-500 border-2 border-blue-700 text-white font-bold text-[10px] uppercase shadow-sm active:translate-y-0.5 transition-transform"
                >
                  Mode
                </button>
                {cursorMode === 'pencil' && currentDrawing.length > 2 && (
                   <button 
                    onClick={() => {
                      // @ts-ignore
                      if (window._finishPencilDrawing) window._finishPencilDrawing();
                    }}
                    className="h-8 px-2 bg-green-500 border-2 border-green-700 text-white font-bold text-[10px] uppercase shadow-sm active:translate-y-0.5 animate-pulse"
                  >
                    Finish
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="xp-taskbar bg-[#0996f1] h-full flex items-center px-4 border-l border-[#0877c1] text-white text-xs drop-shadow gap-2">
            <button 
              onClick={toggleFullScreen}
              className="flex items-center gap-2 hover:bg-white/20 p-1 rounded transition-colors cursor-none"
              title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
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
              className="absolute bottom-10 left-0 w-full md:w-80 h-[450px] max-h-[70vh] bg-white z-30 shadow-2xl rounded-t-lg overflow-hidden border-2 border-[#245edb]"
            >
              <div className="h-16 bg-gradient-to-b from-[#1941a5] to-[#245edb] p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded border-2 border-white bg-blue-300 flex items-center justify-center overflow-hidden">
                  <Monitor className="text-white" />
                </div>
                <span className="text-white font-bold text-lg truncate pr-2">{username}</span>
              </div>
              <div className="flex h-[calc(100%-116px)]">
                <div className="w-1/2 p-2 border-r border-blue-100 flex flex-col gap-1">
                  <div 
                    onClick={() => {
                      toggleWindow('browser-exe', true);
                      setIsStartOpen(false);
                    }}
                    className="flex items-center gap-2 p-1 hover:bg-blue-600 hover:text-white cursor-pointer rounded group"
                  >
                    <Chrome size={20} className="text-blue-500 group-hover:text-white" />
                    <span className="text-xs">Internet Explorer</span>
                  </div>
                  <div 
                    onClick={() => {
                      toggleWindow('explorer-exe', true);
                      setIsStartOpen(false);
                    }}
                    className="flex items-center gap-2 p-1 hover:bg-blue-600 hover:text-white cursor-pointer rounded group"
                  >
                    <Folder size={20} className="text-yellow-500 group-hover:text-white" />
                    <span className="text-xs">File Explorer</span>
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
                <button 
                  onClick={() => {
                    handleLogout();
                    setIsStartOpen(false);
                  }}
                  className="text-white text-xs flex items-center gap-1 hover:underline"
                >
                  <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center font-bold">L</div>
                  Log Off
                </button>
                <button 
                   onClick={() => setIsBooting(true)}
                   className="text-white text-xs flex items-center gap-1 hover:underline"
                >
                  <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center font-bold">T</div>
                  Turn Off Computer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selection Wheel UI */}
        <AnimatePresence>
          {isWheelOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/40 backdrop-blur-[4px]"
            >
              <div className="relative w-80 h-80 flex items-center justify-center">
                {/* Outer Ring */}
                <div className="absolute inset-0 border-8 border-white/10 rounded-full scale-110" />
                
                {/* Center Label */}
                <div className="text-center z-10 pointer-events-none">
                  <h3 className="text-white font-black text-2xl tracking-tighter uppercase italic drop-shadow-lg">
                    {wheelSelection ? wheelSelection : 'SELECT ATTACK'}
                  </h3>
                  <p className="text-white/50 text-[10px] font-bold tracking-widest uppercase">Release to Activate</p>
                </div>
                
                {/* Slices */}
                {[
                  { id: 'lasso', icon: '/Lasso head.png', angle: -90, color: 'bg-amber-700', label: 'LASSO' },
                  { id: 'bsod', icon: '/BSOD.png', angle: 30, color: 'bg-blue-600', label: 'GLOBAL BSOD' },
                  { id: 'storm', icon: 'https://img.icons8.com/color/96/commercial.png', angle: 150, color: 'bg-yellow-500', label: 'AD STORM' }
                ].map((item, i) => {
                  const rad = (item.angle * Math.PI) / 180;
                  const dist = 120;
                  const x = Math.cos(rad) * dist;
                  const y = Math.sin(rad) * dist;
                  
                  const isBought = unlockedModes.includes(`${item.id}-personal`) || serverUnlockedItems.includes(`${item.id}-server`);
                  const onCooldown = cooldowns[item.id] && Date.now() < cooldowns[item.id];
                  const isSelected = wheelSelection === item.id;
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                      animate={{ scale: 1, opacity: 1, x, y }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300, delay: i * 0.05 }}
                      onMouseEnter={() => !isMobile && isBought && !onCooldown && setWheelSelection(item.id)}
                      onClick={() => {
                        if (!isBought || onCooldown) return;
                        if (isMobile) {
                           setWheelSelection(item.id);
                           const now = Date.now();
                           if (item.id === 'lasso') {
                             setCursorMode('lasso');
                           } else if (item.id === 'bsod') {
                             if (!cooldownsRef.current['bsod'] || now >= cooldownsRef.current['bsod']) {
                               socketRef.current?.emit('bsod-trigger');
                               setCooldowns(prev => ({ ...prev, bsod: now + 45000 }));
                             }
                           } else if (item.id === 'storm') {
                             if (!cooldownsRef.current['storm'] || now >= cooldownsRef.current['storm']) {
                               socketRef.current?.emit('storm-trigger');
                               setCooldowns(prev => ({ ...prev, storm: now + 30000 }));
                             }
                           }
                           setIsWheelOpen(false);
                           setWheelSelection(null);
                        }
                      }}
                      className={`absolute w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 transition-all overflow-hidden
                        ${isSelected ? 'scale-125 border-white shadow-[0_0_30px_rgba(255,255,255,0.5)] z-20' : 'scale-100 border-white/20'}
                        ${!isBought ? 'bg-gray-800/80 grayscale' : onCooldown ? 'bg-black/90' : item.color}
                      `}
                    >
                      <img src={item.icon} className={`w-12 h-12 object-contain ${onCooldown ? 'opacity-30' : ''}`} alt={item.id} />
                      {!isBought ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                           <Lock className="text-white" size={24} />
                        </div>
                      ) : onCooldown ? (
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                           <span className="text-white font-black text-lg">
                             {Math.ceil((cooldowns[item.id] - Date.now())/1000)}s
                           </span>
                           <span className="text-[8px] text-white/50 font-bold">READY IN</span>
                        </div>
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Custom Cursor Artifact (Global - Local) */}
        <div 
          className="custom-cursor pointer-events-none"
          style={{ 
            left: `${uiMousePos.x}%`,
            top: `${uiMousePos.y}%`,
            zIndex: 9999999,
            transform: 'translate(-2px, -2px)'
          }}
        >
          <CustomCursorIcon 
            isClicked={isClicked} 
            mode={cursorMode} 
            chargeProgress={chargeProgress} 
            isLassoActive={lassoState.active} 
            lassoAngle={lassoState.swingAngle}
            color={health <= 0 ? "#555" : (isGameActive ? "#60a5fa" : "white")} 
          />

          {/* Local Name Label */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <div className="bg-[#245edb] text-white text-[9px] px-2 py-0.5 border border-white/40 shadow-md whitespace-nowrap mb-1">
              {username} (YOU)
            </div>
          </div>

          {/* Floating Stamina Bar */}
          {stamina < 100 && (windows.find(w => w.id === 'fights-exe')?.isOpen || isGameActive || currentServer === 'training') && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 -bottom-4 -translate-x-1/2 w-10 h-1.5 bg-black/40 border border-white/50 rounded-full overflow-hidden"
            >
              <div 
                className={`h-full transition-all duration-100 ${stamina < 25 ? 'bg-red-500' : 'bg-blue-400'}`}
                style={{ width: `${stamina}%` }}
              />
            </motion.div>
          )}

          {/* Floating Ink Bar for Pencil/Lasso */}
          {currentDrawing.length > 0 && (cursorMode === 'pencil' || cursorMode === 'lasso') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 -top-4 -translate-x-1/2 w-10 h-1.5 bg-black/60 border border-white/40 rounded-full overflow-hidden"
            >
              <div 
                className={`h-full transition-all duration-75 ${
                  currentDrawing.length > (cursorMode === 'pencil' ? 120 : 80) ? 'bg-red-500 animate-pulse' : 'bg-white'
                }`}
                style={{ width: `${(currentDrawing.length / (cursorMode === 'pencil' ? 150 : 100)) * 100}%` }}
              />
            </motion.div>
          )}
          
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
                animate={{ opacity: 1, scale: 0.8, y: -140 }}
                exit={{ opacity: 0, scale: 0.6, y: -160 }}
                className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              >
                <div className="bg-[#ccc] border-[2px] border-t-white border-l-white border-b-gray-800 border-r-gray-800 p-1 shadow-2xl flex flex-col items-center min-w-[60px]">
                  <div className="bg-[#000080] text-white text-[6px] px-2 py-0.5 w-full text-center uppercase font-bold mb-1 border-b border-black">
                    {cursorMode}
                  </div>
                  <div className="relative w-8 h-8 bg-white border-2 border-gray-500 flex items-center justify-center overflow-hidden shadow-inner">
                    <motion.div
                      key={cursorMode}
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                      <img 
                        src={
                          cursorMode === 'pencil' ? '/Pen_mouse.png' :
                          cursorMode === 'eraser' ? '/recycle-bin.png' :
                          cursorMode.includes('bsod') ? '/BSOD.png' :
                          cursorMode.includes('storm') ? 'https://img.icons8.com/color/96/commercial.png' :
                          cursorMode === 'hammer' ? 'https://img.icons8.com/pixel-serif/64/null/hammer.png' :
                          cursorMode === 'spray' ? 'https://img.icons8.com/pixel-serif/64/null/paint-spray.png' :
                          cursorMode === 'bucket' ? 'https://img.icons8.com/pixel-serif/64/null/paint-bucket.png' :
                          cursorMode === 'stamp' ? 'https://img.icons8.com/pixel-serif/64/null/stamp.png' :
                          'https://img.icons8.com/pixel-serif/64/null/pencil.png'
                        }
                        className="w-6 h-6 object-contain pixelated"
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

        {/* Ability Hotbar HUD */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 z-[150] pointer-events-none">
          {shopItems.map((item) => {
            const isBought = unlockedModes.some(m => m.includes(item.id)) || serverUnlockedItems.some(m => m.includes(item.id));
            const onCooldown = cooldowns[item.id] && Date.now() < cooldowns[item.id];
            const isActive = cursorMode === item.id;
            
            if (!isBought) return null;

            return (
              <motion.div
                key={item.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`relative w-12 h-12 bg-[#ccc] border-[2px] border-t-white border-l-white border-b-gray-800 border-r-gray-800 flex items-center justify-center shadow-lg pointer-events-auto cursor-pointer group
                  ${isActive ? 'ring-2 ring-blue-500 scale-110 shadow-blue-500/50' : ''}
                  ${onCooldown ? 'opacity-70 grayscale' : ''}
                `}
                onClick={() => {
                   if (onCooldown) return;
                   if (item.id === 'lasso') setCursorMode('lasso');
                   if (item.id === 'bsod') {
                      const now = Date.now();
                      if (!cooldowns['bsod'] || now >= cooldowns['bsod']) {
                        socketRef.current?.emit('bsod-trigger');
                        setCooldowns(prev => ({ ...prev, bsod: now + 45000 }));
                      }
                   }
                   if (item.id === 'storm') {
                      const now = Date.now();
                      if (!cooldowns['storm'] || now >= cooldowns['storm']) {
                        socketRef.current?.emit('storm-trigger');
                        setCooldowns(prev => ({ ...prev, storm: now + 30000 }));
                      }
                   }
                }}
              >
                <img src={item.icon} className={`w-8 h-8 object-contain pixelated ${onCooldown ? 'opacity-40' : ''}`} alt={item.id} />
                
                {onCooldown && (
                  <>
                    <motion.div 
                      initial={{ height: "100%" }}
                      animate={{ height: "0%" }}
                      transition={{ duration: (cooldowns[item.id] - Date.now()) / 1000, ease: "linear" }}
                      className="absolute bottom-0 left-0 w-full bg-black/40"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold font-mono drop-shadow-md">
                        {Math.ceil((cooldowns[item.id] - Date.now()) / 1000)}
                      </span>
                    </div>
                  </>
                )}

                {/* Mode Label */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[7px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/20 z-[200]">
                   {item.name}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Ad Storm Popups */}
        <AnimatePresence>
          {adPopups.map((popup) => (
            <motion.div
              key={popup.id}
              initial={{ scale: 0, x: `${popup.x}%`, y: `${popup.y}%` }}
              animate={{ scale: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              drag
              className="fixed z-[9999] w-64 bg-[#ece9d8] border-2 border-[#808080] border-t-white border-l-white shadow-xl flex flex-col"
              style={{ left: `${popup.x}%`, top: `${popup.y}%` }}
            >
              <div className="bg-gradient-to-r from-[#000080] to-[#1084d0] p-1 flex justify-between items-center px-2">
                <span className="text-white text-[10px] font-bold truncate pr-2">{popup.content}</span>
                <button 
                  onClick={() => setAdPopups(prev => prev.filter(p => p.id !== popup.id))}
                  className="bg-[#c0c0c0] border border-white hover:bg-red-500 hover:text-white w-4 h-4 flex items-center justify-center text-[10px] font-bold"
                >×</button>
              </div>
              <div className="p-4 bg-white flex flex-col items-center gap-3 min-h-[100px] justify-center text-center">
                <AlertTriangle className="text-yellow-500" size={24} />
                <p className="text-[11px] font-bold leading-tight">{popup.content}</p>
                <button 
                  onClick={() => setAdPopups(prev => prev.filter(p => p.id !== popup.id))}
                  className="bg-[#ece9d8] border-2 border-gray-800 border-t-white border-l-white px-4 py-1 text-[10px] font-bold active:border-t-gray-800 active:border-l-gray-800 active:bg-gray-300"
                >OK</button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* BSOD Overlay */}
        <AnimatePresence>
          {isBSODActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ 
                  opacity: 1,
                  x: bsodGlitched ? [0, -5, 5, -2, 0] : 0,
                  y: bsodGlitched ? [0, 2, -2, 1, 0] : 0,
                  filter: bsodGlitched ? ["brightness(1)", "brightness(2)", "contrast(3)"] : "brightness(1)",
                  scale: bsodGlitched ? [1, 1.02, 0.98, 1] : 1
              }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] bg-[#000080] flex flex-col items-center justify-center p-8 overflow-hidden select-none"
            >
              {/* BSOD Content */}
              <div className="text-white font-mono text-sm max-w-2xl text-left flex flex-col gap-4">
                <div className="bg-white text-[#000080] inline-block px-2 font-bold mb-4">Windows</div>
                <p className="text-xl font-bold mb-4">A problem has been detected and Windows has been shut down to prevent damage to your computer.</p>
                <p>DRIVER_IRQL_NOT_LESS_OR_EQUAL</p>
                <p>If this is the first time you've seen this stop error screen, restart your computer. If this screen appears again, follow these steps:</p>
                <p>Check to make sure any new hardware or software is properly installed. If this is a new installation, ask your hardware or software manufacturer for any Windows updates you might need.</p>
                <p>*** STOP: 0x000000D1 (0x00000000, 0x00000002, 0x00000000, 0xF73120AE)</p>
                <p className="mt-4">Beginning dump of physical memory.</p>
                <p>Physical memory dump complete.</p>
                <p>Contact your system administrator or technical support group for further assistance.</p>
              </div>
              <div className="absolute inset-0 pointer-events-none opacity-10 bg-white/5 animate-pulse mix-blend-overlay" />
              {/* Optional image overlay if provided by user */}
              <img src="/BSOD.png" className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none mix-blend-overlay" alt="" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Other Users' Cursors */}
        {Object.entries(otherUsers).map(([id, user]) => {
          const u = user as UserState;
          return (
            <motion.div 
              key={id}
              className="custom-cursor pointer-events-none"
              animate={{ 
                left: `${(u.x / 1000) * 100}%`,
                top: `${(u.y / 1000) * 100}%`,
                rotate: u.isRagdoll ? [0, 90, 180, 270, 360] : 0,
                scale: u.isRagdoll ? 1.2 : 1
              }}
              transition={{ 
                left: { duration: 0.1, ease: "linear" },
                top: { duration: 0.1, ease: "linear" },
                rotate: u.isRagdoll ? { repeat: Infinity, duration: 0.3, ease: "linear" } : { duration: 0.2 },
                scale: { duration: 0.2 }
              }}
              style={{ zIndex: 9000 }}
            >
              <div className={u.isRagdoll ? 'blur-[1px] opacity-80' : ''}>
                 <CustomCursorIcon mode={u.cursorMode} color={u.health <= 0 ? "#555" : "#ff6b6b"} />
              </div>
                <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                  <div className="bg-[#FFFFE1] text-black text-[9px] px-2 py-0.5 border border-black shadow-[2px_2px_0_rgba(0,0,0,0.2)] whitespace-nowrap mb-1">
                    {u.username} {u.isReady && "✓"}
                  </div>
                  {(isGameActive || u.health < 100) && (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-1.5 bg-gray-900 border border-black overflow-hidden relative">
                        <motion.div 
                          animate={{ width: `${u.health}%` }}
                          className="h-full bg-red-500 absolute inset-0"
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                      <span className="text-[6px] text-white bg-black/50 px-1 mt-0.5 border border-white/20">
                        {u.health}HP
                      </span>
                    </div>
                  )}
                </div>
            </motion.div>
          );
        })}
        </motion.div>
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

