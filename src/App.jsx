import React, { useState, useEffect, useRef } from 'react';

// Lucide Icons (Clean Stroke Style)
const Icons = {
  Play: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Pause: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  Activity: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Volume2: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  VolumeX: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" x2="17" y1="9" y2="15" />
      <line x1="17" x2="23" y1="9" y2="15" />
    </svg>
  )
};

export default function App() {
  const [cycleDuration, setCycleDuration] = useState(10); 
  const [currentPhaseDuration, setCurrentPhaseDuration] = useState(5000); 
  const [isBreathingIn, setIsBreathingIn] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [volume, setVolume] = useState(0.5); 
  
  const targetDurationRef = useRef(10); 
  const audioCtxRef = useRef(null);
  const soundEnabledRef = useRef(isSoundEnabled);
  const volumeRef = useRef(volume);

  useEffect(() => {
    soundEnabledRef.current = isSoundEnabled;
  }, [isSoundEnabled]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

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

  const playTone = (type) => {
    if (!audioCtxRef.current || !soundEnabledRef.current) return;
    
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    const attack = 0.6; 
    const decay = 3.5;

    if (type === 'inhale') {
      osc.frequency.setValueAtTime(220, now); // A3
      osc.type = 'sine';
    } else if (type === 'exhale') {
      osc.frequency.setValueAtTime(146.83, now); // D3
      osc.type = 'sine';
    } else if (type === 'test') {
      osc.frequency.setValueAtTime(440, now);
    }

    const maxGain = volumeRef.current * 0.5;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(maxGain, now + attack); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + decay);

    osc.start(now);
    osc.stop(now + decay);
  };

  const handleTransitionEnd = () => {
    if (!isActive) return;

    const nextDuration = (targetDurationRef.current * 1000) / 2;
    setCurrentPhaseDuration(nextDuration);

    setIsBreathingIn(prev => {
      const nextState = !prev;
      if (nextState) playTone('inhale');
      else playTone('exhale');
      return nextState;
    });
  };

  const handleSpeedChange = (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setCycleDuration(val);
      targetDurationRef.current = val;
    }
  };

  const handleVolumeChange = (e) => {
    setVolume(parseFloat(e.target.value));
  };

  const togglePlayPause = () => {
    initAudioSafe();
    
    if (!isActive) {
      setIsActive(true);
      const startDuration = (targetDurationRef.current * 1000) / 2;
      setCurrentPhaseDuration(startDuration);
      setIsBreathingIn(true);
      playTone('inhale');
    } else {
      setIsActive(false);
      setIsBreathingIn(false); 
      setCurrentPhaseDuration(500); 
    }
  };

  const toggleSound = () => {
    initAudioSafe();
    const newState = !isSoundEnabled;
    setIsSoundEnabled(newState);
    if (newState && audioCtxRef.current) {
      playTone('test');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 transition-colors duration-700 overflow-hidden font-sans">
      
      {/* Custom Styles for Round Range Slider Thumbs */}
      <style>{`
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
      `}</style>

      <div className="w-full max-w-md relative z-10 flex flex-col gap-10">
        
        {/* Header */}
        <header className="flex flex-col gap-2 items-center text-center">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold tracking-wider uppercase">
            <Icons.Activity />
            <span>Resonance</span>
          </div>
          <h1 className="text-4xl font-bold text-white/90 tracking-tight">
            Deep Breath
          </h1>
        </header>

        {/* The Breathing Widget */}
        <div className="relative aspect-square w-full max-w-[320px] mx-auto flex items-center justify-center">
          
          {/* Guides */}
          <div className="absolute w-[240px] h-[240px] border-2 border-zinc-500 rounded-full border-dashed opacity-60" />
          <div className="absolute w-[100px] h-[100px] border-2 border-zinc-700 rounded-full opacity-40" />
          
          {/* Core White Circle */}
          <div 
            className="breathing-circle relative z-10 bg-white rounded-full flex items-center justify-center shadow-none"
            onTransitionEnd={handleTransitionEnd} 
            style={{
              width: '100px',
              height: '100px',
              transform: isBreathingIn ? 'scale(2.4)' : 'scale(1)', 
              transitionProperty: 'transform',
              transitionDuration: `${isActive ? currentPhaseDuration : 500}ms`,
              transitionTimingFunction: 'ease-in-out'
            }}
          />
        </div>

        {/* Text Guidance */}
        <div className="text-center h-8 flex flex-col items-center justify-center">
           <p className={`text-zinc-400 text-xl font-bold transition-opacity duration-500`}>
             {isActive 
               ? (isBreathingIn ? "Breathe In" : "Breathe Out") 
               : "Ready to start"}
           </p>
        </div>

        {/* Controls Card */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] space-y-6">
          
          {/* Row 1: Speed Control */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 font-bold text-sm">Breath Cycle</span>
              <span className="text-black bg-white font-bold px-3 py-1 rounded-full text-xs">
                {cycleDuration}s
              </span>
            </div>
            
            <input
              type="range"
              min="4"
              max="40"
              step="1"
              value={cycleDuration}
              onChange={handleSpeedChange}
              className="w-full"
            />
            
            <div className="flex justify-between text-xs text-zinc-600 font-bold px-1">
              <span>Fast (4s)</span>
              <span>Deep (40s)</span>
            </div>
          </div>

          {/* Row 2: Dynamic Audio & Play Actions */}
          <div className="flex gap-3 h-16">
            
            {/* Audio Toggle & Slider Group */}
            <div 
              className={`
                bg-zinc-800 rounded-2xl flex items-center overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] flex-none
                ${isSoundEnabled ? 'w-48' : 'w-16'}
              `}
            >
              {/* Icon Container */}
              <button 
                onClick={toggleSound}
                className={`
                  w-16 h-full flex items-center justify-center flex-shrink-0 transition-colors 
                  ${isSoundEnabled ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
                `}
                aria-label="Toggle Sound"
              >
                {isSoundEnabled ? <Icons.Volume2 /> : <Icons.VolumeX />}
              </button>
              
              {/* Volume Slider */}
              <div 
                className={`
                  w-32 pr-4 flex items-center transition-opacity duration-300 delay-100
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
