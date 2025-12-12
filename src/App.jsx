import React, { useState, useEffect, useRef } from 'react';

// Web Worker for precision timing
const timerWorkerScript = `
  let timerId = null;

  self.onmessage = function(e) {
    const { type, duration } = e.data;

    if (type === 'START_TIMER') {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        self.postMessage('TICK');
      }, duration);
    } else if (type === 'STOP_TIMER') {
      if (timerId) clearTimeout(timerId);
    }
  };
`;

// Lucide Icons (Stroke Style)
const Icons = {
  Play: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" xmlns="http://www.w3.org/2000/svg"><polygon points="5 3 19 12 5 21 5 3" /></svg>,
  Pause: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>,
  Activity: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  Volume2: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>,
  VolumeX: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" x2="17" y1="9" y2="15" /><line x1="17" x2="23" y1="9" y2="15" /></svg>,
  Waves: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /></svg>,
  Square: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /></svg>,
  Moon: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
};

// --- CONFIGURATION CONSTANTS ---
const MODES = {
  RESONANCE: {
    id: 'resonance',
    name: 'Resonance',
    desc: 'Balance & HRV', 
    icon: Icons.Waves,
    pattern: [
      { type: 'inhale', scale: 1 }, 
      { type: 'exhale', scale: 1 }
    ],
    defaultBase: 5.5,
    sliderLabel: 'Total Cycle',
    sliderMin: 4, 
    sliderMax: 16,
    sliderStep: 0.5,
    colorHex: '#34d399', 
    colorClass: 'text-emerald-400',
    entrainmentHz: 10 
  },
  BOX: {
    id: 'box',
    name: 'Box',
    desc: 'Focus & Stress', 
    icon: Icons.Square,
    pattern: [
      { type: 'inhale', scale: 1 },
      { type: 'hold-in', scale: 1 },
      { type: 'exhale', scale: 1 },
      { type: 'hold-out', scale: 1 }
    ],
    defaultBase: 4,
    sliderLabel: 'Step Duration',
    sliderMin: 2,
    sliderMax: 6,
    sliderStep: 0.5,
    colorHex: '#60a5fa',
    colorClass: 'text-blue-400',
    entrainmentHz: 14 
  },
  RELAX: {
    id: 'relax',
    name: 'Relax',
    desc: 'Sleep & Anxiety', 
    icon: Icons.Moon,
    pattern: [
      { type: 'inhale', scale: 4 },
      { type: 'hold-in', scale: 7 },
      { type: 'exhale', scale: 8 }
    ],
    defaultBase: 1,
    sliderLabel: 'Scale',
    sliderMin: 0.5,
    sliderMax: 1.5,
    sliderStep: 0.1,
    isRatio: true,
    colorHex: '#fbbf24',
    colorClass: 'text-amber-400',
    entrainmentHz: 4 
  }
};

export default function App() {
  const [activeModeKey, setActiveModeKey] = useState('RESONANCE');
  const [baseDuration, setBaseDuration] = useState(MODES.RESONANCE.defaultBase); 
  
  const [currentPhaseDuration, setCurrentPhaseDuration] = useState(5500); 
  const [isExpanded, setIsExpanded] = useState(false);
  const [phaseType, setPhaseType] = useState('ready'); 
  
  const [isActive, setIsActive] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [volume, setVolume] = useState(0.5); 
  
  const baseDurationRef = useRef(baseDuration); 
  const modeKeyRef = useRef(activeModeKey);
  const patternIndexRef = useRef(0);

  const audioCtxRef = useRef(null);
  const droneNodesRef = useRef(null);
  const soundEnabledRef = useRef(isSoundEnabled);
  const volumeRef = useRef(volume);
  const workerRef = useRef(null);

  useEffect(() => {
    soundEnabledRef.current = isSoundEnabled;
    if (droneNodesRef.current && audioCtxRef.current) {
      droneNodesRef.current.gain.gain.setTargetAtTime(volume * 0.15, audioCtxRef.current.currentTime, 0.1);
    }
  }, [isSoundEnabled, volume]);

  useEffect(() => {
    baseDurationRef.current = baseDuration;
  }, [baseDuration]);

  useEffect(() => {
    const blob = new Blob([timerWorkerScript], { type: 'application/javascript' });
    workerRef.current = new Worker(URL.createObjectURL(blob));

    workerRef.current.onmessage = (e) => {
      if (e.data === 'TICK') {
        handleTick();
      }
    };

    return () => {
      workerRef.current.terminate();
    };
  }, []);

  const initAudioSafe = () => {
    if (typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtxRef.current = new AudioContext();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (e) {
      console.warn("Audio initialization failed:", e);
    }
  };

  const startDrone = (mode) => {
    if (!audioCtxRef.current || !soundEnabledRef.current) return;
    stopDrone();

    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const baseFreq = 110; 
    const beatFreq = mode.entrainmentHz;

    const oscL = ctx.createOscillator();
    const panL = ctx.createStereoPanner();
    panL.pan.value = -1;
    oscL.frequency.value = baseFreq;

    const oscR = ctx.createOscillator();
    const panR = ctx.createStereoPanner();
    panR.pan.value = 1;
    oscR.frequency.value = baseFreq + beatFreq;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(volumeRef.current * 0.1, now + 2); 

    oscL.connect(panL);
    oscR.connect(panR);
    panL.connect(masterGain);
    panR.connect(masterGain);
    masterGain.connect(ctx.destination);

    oscL.start(now);
    oscR.start(now);

    droneNodesRef.current = { oscL, oscR, gain: masterGain };
  };

  const stopDrone = () => {
    if (droneNodesRef.current) {
      const { oscL, oscR, gain } = droneNodesRef.current;
      const ctx = audioCtxRef.current;
      if (ctx) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        oscL.stop(ctx.currentTime + 0.5);
        oscR.stop(ctx.currentTime + 0.5);
      }
      droneNodesRef.current = null;
    }
  };

  const playTone = (type, durationMs) => {
    if (!audioCtxRef.current || !soundEnabledRef.current) return;
    
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    let freq = 220;
    let maxGain = volumeRef.current * 0.5;
    let attack = 0.05;
    let decay = 1.5;
    let isDrone = false;

    if (type === 'inhale') {
      freq = 220; 
    } else if (type === 'exhale') {
      freq = 146.83; 
    } else if (type === 'hold-in') {
      freq = 220; 
      isDrone = true;
      maxGain = volumeRef.current * 0.3; 
      attack = 0.5;
    } else if (type === 'hold-out') {
      freq = 146.83; 
      isDrone = true;
      maxGain = volumeRef.current * 0.3; 
      attack = 0.5;
    } else if (type === 'test') {
      freq = 440;
    }

    osc.frequency.setValueAtTime(freq, now);
    osc.type = 'sine';

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(maxGain, now + attack);
    
    if (isDrone) {
       const holdSeconds = durationMs / 1000;
       gainNode.gain.setValueAtTime(maxGain, now + holdSeconds - 0.5); 
       gainNode.gain.exponentialRampToValueAtTime(0.001, now + holdSeconds);
       osc.start(now);
       osc.stop(now + holdSeconds + 0.1);
    } else {
       gainNode.gain.exponentialRampToValueAtTime(0.001, now + decay);
       osc.start(now);
       osc.stop(now + decay + 0.5);
    }
  };

  const handleTick = () => {
    const currentMode = MODES[modeKeyRef.current];
    const pattern = currentMode.pattern;
    
    let nextIndex = patternIndexRef.current + 1;
    if (nextIndex >= pattern.length) {
      nextIndex = 0; 
    }
    patternIndexRef.current = nextIndex;

    const phaseConfig = pattern[nextIndex];
    const durationMs = baseDurationRef.current * phaseConfig.scale * 1000;

    setPhaseType(phaseConfig.type);
    setCurrentPhaseDuration(durationMs);

    if (phaseConfig.type === 'inhale') {
      setIsExpanded(true);
      playTone('inhale', durationMs);
    } else if (phaseConfig.type === 'exhale') {
      setIsExpanded(false);
      playTone('exhale', durationMs);
    } else if (phaseConfig.type === 'hold-in') {
      playTone('hold-in', durationMs);
    } else if (phaseConfig.type === 'hold-out') {
      playTone('hold-out', durationMs);
    }

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'START_TIMER', duration: durationMs });
    }
  };

  const switchMode = (key) => {
    setActiveModeKey(key);
    modeKeyRef.current = key;
    setBaseDuration(MODES[key].defaultBase);
    
    if (isActive) {
      togglePlayPause();
    }
  };

  const handleSliderChange = (e) => {
    setBaseDuration(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e) => {
    setVolume(parseFloat(e.target.value));
  };

  const togglePlayPause = () => {
    initAudioSafe();
    
    if (!isActive) {
      // STARTING
      setIsActive(true);
      
      const currentMode = MODES[modeKeyRef.current];
      patternIndexRef.current = 0;
      
      const firstPhase = currentMode.pattern[0];
      const startDuration = baseDurationRef.current * firstPhase.scale * 1000;
      
      setCurrentPhaseDuration(startDuration);
      setPhaseType('inhale');
      setIsExpanded(true);
      playTone('inhale', startDuration);
      startDrone(currentMode);

      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'START_TIMER', duration: startDuration });
      }

    } else {
      // STOPPING
      setIsActive(false);
      setIsExpanded(false);
      setPhaseType('ready');
      setCurrentPhaseDuration(500);
      stopDrone();
      
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP_TIMER' });
      }
    }
  };

  const toggleSound = () => {
    initAudioSafe();
    const newState = !isSoundEnabled;
    setIsSoundEnabled(newState);
    
    if (newState) {
        if (isActive) {
            startDrone(MODES[modeKeyRef.current]);
        } else {
            playTone('test', 500);
        }
    } else {
        stopDrone();
    }
  };

  const getGuidanceText = () => {
    if (!isActive) {
      const mode = MODES[activeModeKey];
      return (
        <span className="flex flex-col items-center gap-1 transition-all duration-500 animate-in fade-in slide-in-from-bottom-1">
          <span className="text-[16px] text-zinc-200 font-bold tracking-wide text-lg">{mode.name}</span>
          <span className="text-xs text-zinc-500 font-medium tracking-wider uppercase">{mode.desc}</span>
        </span>
      );
    }
    
    let text = "Ready";
    switch (phaseType) {
      case 'inhale': text = "Breathe In"; break;
      case 'hold-in': text = "Hold"; break;
      case 'exhale': text = "Breathe Out"; break;
      case 'hold-out': text = "Hold"; break;
    }
    
    return (
      <span className="text-[20px] text-zinc-200 font-bold tracking-wide text-lg">
        {text}
      </span>
    );
  };

  const getSliderValueText = () => {
    const mode = MODES[activeModeKey];
    if (mode.isRatio) {
      return `${baseDuration.toFixed(1)}x`;
    }
    if (activeModeKey === 'RESONANCE') {
      return `${(baseDuration * 2).toFixed(1)}s`;
    }
    return `${baseDuration.toFixed(1)}s`;
  };

  const activeMode = MODES[activeModeKey];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 transition-colors duration-700 overflow-hidden font-quicksand relative">
      
      {/* RESTORED: Quicksand Font Import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
        
        .font-quicksand {
          font-family: 'Geist', sans-serif;
        }

        input[type=range] {
          -webkit-appearance: none;
          background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          margin-top: -8px;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
        input[type=range]::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: none;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: #3f3f46;
          border-radius: 9999px;
        }
        input[type=range]::-moz-range-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: #3f3f46;
          border-radius: 9999px;
        }
        input[type=range]:focus {
          outline: none;
        }
        
        .breathing-circle {
          will-change: transform;
          backface-visibility: hidden;
          transform-style: preserve-3d;
        }

        /* Fluid Drift Animation for Waves */
        @keyframes drift {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-drift {
          animation: drift 40s infinite linear;
        }
        .animate-drift-slow {
          animation: drift 60s infinite linear reverse;
        }
      `}</style>

      {/* Dynamic Ambient Background - Neutral Fluid Waves */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 flex items-center justify-center opacity-40">
        {/* Wave 1 */}
        <div 
          className="absolute w-[180vw] h-[180vw] rounded-[40%] bg-zinc-400/10 animate-drift"
          style={{ top: '50%' }}
        />
        {/* Wave 2 */}
        <div 
          className="absolute w-[180vw] h-[180vw] rounded-[45%] bg-zinc-700/5 animate-drift-slow"
          style={{ top: '55%', left: '30%' }}
        />
      </div>

      <div className="w-full max-w-md relative z-10 flex flex-col gap-10">
        
        {/* Header - Editorial Style */}
        <header className="flex flex-col gap-2 items-center text-center">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-zinc-500">
            <div 
              className={`transition-all duration-700 ${isActive ? activeMode.colorClass : ''}`}
              style={{ filter: isActive ? `drop-shadow(0 0 8px ${activeMode.colorHex}80)` : 'none' }}
            >
              <Icons.Activity />
            </div>
            <span>Breathe</span>
          </div>
          <h1 className="text-2xl font-bold text-white/90">
            Meditative Deep Breathing
          </h1>
        </header>

        {/* The Breathing Widget */}
        <div className="relative aspect-square w-full max-w-[320px] mx-auto flex items-center justify-center">
          
          {/* Guides */}
          <div className="absolute w-[240px] h-[240px] border-2 border-zinc-500 rounded-full border-dashed opacity-60" />
          <div className="absolute w-[100px] h-[100px] border-2 border-zinc-700 rounded-full opacity-40" />
          
          {/* Visual Anchor (Quiet Eye) */}
          <div className="absolute z-50 w-1.5 h-1.5 bg-black/50 rounded-full pointer-events-none" />

          {/* Core Breathing Circle */}
          <div 
            className="breathing-circle relative z-10 rounded-full flex items-center justify-center shadow-none transition-colors duration-700"
            style={{
              backgroundColor: isActive ? activeMode.colorHex : '#ffffff',
              width: '100px',
              height: '100px',
              transform: isExpanded ? 'scale(2.4)' : 'scale(1)', 
              transitionProperty: 'transform, background-color',
              transitionDuration: `${isActive ? currentPhaseDuration : 500}ms`,
              transitionTimingFunction: 'ease-in-out',
              boxShadow: isActive ? `0 0 40px ${activeMode.colorHex}40` : 'none'
            }}
          />
        </div>

        {/* Text Guidance */}
        <div className="text-center h-16 flex flex-col items-center justify-center">
           {getGuidanceText()}
        </div>

        {/* Controls Card */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] space-y-6 relative z-10">
          
          {/* Mode Selector */}
          <div className="grid grid-cols-3 gap-1 bg-black/20 p-1 rounded-2xl">
            {Object.keys(MODES).map((key) => {
              const mode = MODES[key];
              const isSelected = activeModeKey === key;
              return (
                <button
                  key={key}
                  onClick={() => switchMode(key)}
                  className={`
                    flex flex-col items-center justify-center py-4 rounded-xl transition-all duration-300 gap-2
                    ${isSelected ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/30'}
                  `}
                >
                  <mode.icon />
                  <span className="text-[10px] font-bold uppercase tracking-wide">{mode.name}</span>
                </button>
              );
            })}
          </div>

          {/* Contextual Slider */}
          <div className="space-y-4 px-2">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 font-bold text-sm">
                {activeMode.sliderLabel}
              </span>
              <span className="text-black bg-white font-bold px-3 py-1 rounded-full text-xs min-w-[3rem] text-center">
                {getSliderValueText()}
              </span>
            </div>
            
            <input
              type="range"
              min={activeMode.sliderMin}
              max={activeMode.sliderMax}
              step={activeMode.sliderStep}
              value={baseDuration}
              onChange={handleSliderChange}
              className="w-full"
            />

            {/* Pattern Times Display (Restored without label) */}
            <div className="text-center text-xs text-zinc-500 font-medium tracking-wide pt-1">
               {activeMode.pattern.map(p => {
                 let val = baseDuration * p.scale;
                 return val.toFixed(1) + "s";
               }).join(" - ")}
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex gap-3 h-16 pt-2">
            
            {/* Audio Toggle */}
            <div 
              className={`
                bg-zinc-800 rounded-2xl flex items-center overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] flex-none
                ${isSoundEnabled ? 'w-48' : 'w-16'}
              `}
            >
              <button 
                onClick={toggleSound}
                className={`
                  w-16 h-full flex items-center justify-center flex-shrink-0 transition-colors 
                  ${isSoundEnabled ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
                `}
              >
                {isSoundEnabled ? <Icons.Volume2 /> : <Icons.VolumeX />}
              </button>
              
              <div 
                className={`
                  w-32 pr-6 flex items-center transition-opacity duration-300 delay-100
                  ${isSoundEnabled ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
              >
                 <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-full"
                />
              </div>
            </div>

            {/* Play Button */}
            <button
              onClick={togglePlayPause}
              className={`
                flex-1 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg transition-all duration-300
                ${isActive 
                  ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700' 
                  : 'bg-white text-black hover:bg-zinc-200 shadow-lg shadow-white/5'}
              `}
            >
              {isActive ? <Icons.Pause /> : <Icons.Play />}
              {isActive ? "Stop" : "Start"}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
