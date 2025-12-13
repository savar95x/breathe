import React, { useState, useEffect, useRef } from 'react';

// Web Worker for precision timing (runs in background tabs)
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

// Lucide Icons
const Icons = {
  Play: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>,
  Pause: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>,
  Activity: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  Volume2: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>,
  VolumeX: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" x2="17" y1="9" y2="15" /><line x1="17" x2="23" y1="9" y2="15" /></svg>,
};

// --- CONFIGURATION CONSTANTS ---
const MODES = {
  RESONANCE: {
    id: 'resonance',
    name: 'Resonance',
    desc: 'Balance & HRV',
    pattern: [
      { type: 'inhale', scale: 1, label: 'In' }, 
      { type: 'exhale', scale: 1, label: 'Out' }
    ],
    defaultBase: 5.5,
    sliderLabel: 'Cycle',
    sliderMin: 4,
    sliderMax: 16,
    sliderStep: 0.5,
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500',
    entrainmentHz: 10
  },
  BOX: {
    id: 'box',
    name: 'Box',
    desc: 'Focus & Stress Relief',
    pattern: [
      { type: 'inhale', scale: 1, label: 'In' },
      { type: 'hold-in', scale: 1, label: 'Hold' },
      { type: 'exhale', scale: 1, label: 'Out' },
      { type: 'hold-out', scale: 1, label: 'Hold' }
    ],
    defaultBase: 4,
    sliderLabel: 'Step',
    sliderMin: 2,
    sliderMax: 6,
    sliderStep: 0.5,
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500',
    entrainmentHz: 14
  },
  RELAX: {
    id: 'relax',
    name: 'Relax',
    desc: 'Sleep & Anxiety Control',
    pattern: [
      { type: 'inhale', scale: 4, label: 'In' },
      { type: 'hold-in', scale: 7, label: 'Hold' },
      { type: 'exhale', scale: 8, label: 'Out' }
    ],
    defaultBase: 1,
    sliderLabel: 'Scale',
    sliderMin: 0.5,
    sliderMax: 1.5,
    sliderStep: 0.1,
    isRatio: true,
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500',
    entrainmentHz: 4
  }
};

const TIMER_OPTIONS = [0, 60, 180, 300, 600, 900, 1200, 1800, 2700, 3600]; 

export default function App() {
  const [activeModeKey, setActiveModeKey] = useState('RESONANCE');
  const [baseDuration, setBaseDuration] = useState(MODES.RESONANCE.defaultBase);
  
  const [currentPhaseDuration, setCurrentPhaseDuration] = useState(5500);
  const [isExpanded, setIsExpanded] = useState(false);
  const [phaseType, setPhaseType] = useState('ready');
  
  const [isActive, setIsActive] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [volume, setVolume] = useState(0.5);
  
  const [sessionLimit, setSessionLimit] = useState(0); 
  const [timeLeft, setTimeLeft] = useState(0);
  
  const baseDurationRef = useRef(baseDuration);
  const modeKeyRef = useRef(activeModeKey);
  const patternIndexRef = useRef(0);
  const startTimeRef = useRef(null);
  const sessionLimitRef = useRef(sessionLimit);

  const audioCtxRef = useRef(null);
  const droneNodesRef = useRef(null);
  const soundEnabledRef = useRef(isSoundEnabled);
  const volumeRef = useRef(volume);
  const workerRef = useRef(null);
  const uiTimerRef = useRef(null);

  useEffect(() => {
    soundEnabledRef.current = isSoundEnabled;
    if (droneNodesRef.current && audioCtxRef.current) {
      droneNodesRef.current.gain.gain.setTargetAtTime(volume * 0.15, audioCtxRef.current.currentTime, 0.1);
    }
  }, [isSoundEnabled, volume]);

  useEffect(() => {
    baseDurationRef.current = baseDuration;
  }, [baseDuration]);

  // Sync Timer Ref
  useEffect(() => {
    sessionLimitRef.current = sessionLimit;
  }, [sessionLimit]);

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
    if (sessionLimitRef.current > 0 && startTimeRef.current) {
        const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
        if (elapsedSec >= sessionLimitRef.current) {
            stopSession();
            return;
        }
    }

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
      stopSession();
    }
  };

  const handleSliderChange = (e) => {
    setBaseDuration(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e) => {
    setVolume(parseFloat(e.target.value));
  };

  const toggleTimerOption = () => {
    const currentIndex = TIMER_OPTIONS.indexOf(sessionLimit);
    const nextIndex = (currentIndex + 1) % TIMER_OPTIONS.length;
    setSessionLimit(TIMER_OPTIONS[nextIndex]);
  };

  const startSession = () => {
    setIsActive(true);
    startTimeRef.current = Date.now();
    
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

    if (sessionLimitRef.current > 0) {
        setTimeLeft(sessionLimitRef.current);
        if (uiTimerRef.current) clearInterval(uiTimerRef.current);
        uiTimerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const remaining = Math.max(0, sessionLimitRef.current - elapsed);
            setTimeLeft(remaining);
            if (remaining <= 0) clearInterval(uiTimerRef.current);
        }, 1000);
    }
  };

  const stopSession = () => {
    setIsActive(false);
    setIsExpanded(false);
    setPhaseType('ready');
    setCurrentPhaseDuration(500);
    stopDrone();
    
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP_TIMER' });
    }
    if (uiTimerRef.current) {
        clearInterval(uiTimerRef.current);
    }
  };

  const togglePlayPause = () => {
    initAudioSafe();
    if (!isActive) {
      startSession();
    } else {
      stopSession();
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
      return "Ready to Start";
    }
    
    switch (phaseType) {
      case 'inhale': return "Breathe In";
      case 'hold-in': return "Hold";
      case 'exhale': return "Breathe Out";
      case 'hold-out': return "Hold";
      default: return "Ready";
    }
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

  const formatTimer = (seconds) => {
    if (seconds === 0) return "∞";
    if (!isActive) {
        return seconds >= 60 ? `${Math.floor(seconds/60)} min` : `${seconds}s`;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const activeMode = MODES[activeModeKey];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans flex flex-col items-center justify-center p-6 relative selection:bg-white selection:text-black">
      
      {/* Sharper Slider Styles */}
      <style>{`
        input[type=range] {
          -webkit-appearance: none;
          background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px;
          width: 16px;
          background: #e4e4e7; /* zinc-200 */
          border-radius: 50%;
          cursor: pointer;
          margin-top: -6px;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
        }
        input[type=range]::-moz-range-thumb {
          height: 16px;
          width: 16px;
          background: #e4e4e7;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: #27272a; /* zinc-800 */
          border-radius: 4px; /* Reduced roundness */
        }
        input[type=range]::-moz-range-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: #27272a;
          border-radius: 4px;
        }
        input[type=range]:focus {
          outline: none;
        }
      `}</style>

      {/* Timer Toggle - Subtle Top Right */}
      <button 
        onClick={toggleTimerOption}
        className="fixed top-6 right-6 text-xs font-medium tracking-wide text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer z-50 flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-sm border border-zinc-800/50"
      >
        <span>Timer: {isActive && sessionLimit > 0 ? formatTimer(timeLeft) : formatTimer(sessionLimit)}</span>
      </button>

      {/* Main Container */}
      <div className="w-full max-w-sm flex flex-col gap-10">
        
        {/* Breathing Visual */}
        <div className="relative aspect-square w-full flex items-center justify-center">
          
          {/* Static Background Guide */}
          <div className="absolute w-[280px] h-[280px] border border-zinc-900 rounded-full" />
          
          {/* Center Anchor */}
          <div className="absolute z-10 w-1.5 h-1.5 bg-zinc-800 rounded-full" />

          {/* Dynamic Breathing Circle */}
          <div 
            key={activeModeKey} /* FIX: Force remount on mode change to reset transition state */
            className={`rounded-full transition-all ease-in-out ${activeMode.bgClass} ${activeMode.colorClass}`}
            style={{
              width: '100px',
              height: '100px',
              opacity: isActive ? 0.8 : 0.2, // Higher opacity when active
              transform: isExpanded ? 'scale(2.4)' : 'scale(1)', 
              transitionDuration: `${isActive ? currentPhaseDuration : 500}ms`,
              boxShadow: isActive ? `0 0 60px -10px currentColor` : 'none',
              willChange: 'transform, opacity' /* Optimize performance */
            }}
          />
        </div>

        {/* Guidance Text */}
        <div className="text-center h-8">
           <p className={`text-2xl font-bold tracking-tight transition-colors duration-500 ${isActive ? 'text-white' : 'text-zinc-600'}`}>
             {getGuidanceText()}
           </p>
        </div>

        {/* Controls Container - Sharper & Cleaner */}
        <div className="flex flex-col gap-8">
          
          {/* Mode Tabs */}
          <div className="flex flex-col gap-3">
            <div className="flex bg-zinc-900/50 p-1 rounded-lg">
              {Object.keys(MODES).map((key) => {
                const mode = MODES[key];
                const isSelected = activeModeKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => switchMode(key)}
                    className={`
                      flex-1 py-3 text-xs font-medium rounded-md transition-all duration-300
                      ${isSelected ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-400'}
                    `}
                  >
                    {mode.name}
                  </button>
                );
              })}
            </div>
            {/* Functional Mode Description */}
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 text-center font-medium">
              Target: <span className="text-zinc-500">{activeMode.desc}</span>
            </div>
          </div>

          {/* Slider Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-end text-xs font-medium text-zinc-500">
              <span>{activeMode.sliderLabel}</span>
              <span className="text-zinc-300">
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
            
            {/* Phase Breakdown */}
            <div className="flex justify-between text-[10px] text-zinc-600 font-medium pt-1">
               {activeMode.pattern.map((p, i) => (
                 <span key={i}>
                   {p.label}: {(baseDuration * p.scale).toFixed(1)}s
                 </span>
               ))}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center gap-4">
            
            {/* Audio Controls */}
            <div className={`flex items-center gap-3 bg-zinc-900/50 rounded-lg px-4 h-14 flex-1 transition-opacity ${isSoundEnabled ? 'opacity-100' : 'opacity-60'}`}>
              <button 
                onClick={toggleSound}
                className={`hover:text-white transition-colors ${isSoundEnabled ? 'text-zinc-200' : 'text-zinc-600'}`}
              >
                {isSoundEnabled ? <Icons.Volume2 /> : <Icons.VolumeX />}
              </button>
              
              <div className="flex-1">
                 <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  disabled={!isSoundEnabled}
                  className="w-full"
                />
              </div>
            </div>

            {/* Play Button - Circle */}
            <button
              onClick={togglePlayPause}
              className={`
                h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
                ${isActive 
                  ? 'bg-zinc-800 text-white hover:bg-zinc-700' 
                  : 'bg-white text-black hover:scale-105 hover:bg-zinc-200'}
              `}
            >
              {isActive ? <Icons.Pause /> : <Icons.Play />}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
