import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEngine } from "./hooks/useEngine";
import { useMultiplayer } from "./hooks/useMultiplayer";
import { useSession } from "./hooks/useSession";
import { speakerNames } from "./words";

// Components
import Quiz from "./Quiz";
import Archive from "./Archive";
import FinishSentence from "./FinishSentence";
import MemoryLane from "./MemoryLane";
import StatsBattle from "./StatsBattle";
import NightSky from "./NightSky";
import BossMode from "./BossMode";
import LoveLetters from "./LoveLetters";
import FloatingParticles from "./FloatingParticles";
import LiveCursor from "./LiveCursor";

// Mobile detection hook - checks user agent for actual mobile devices
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    try {
      // Check user agent for actual mobile devices
      const userAgent = navigator.userAgent || '';
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    } catch (e) {
      // Fallback: assume not mobile if check fails
      setIsMobile(false);
    }
  }, []);

  return isMobile;
};

// Mobile Input Component - triggers native iOS keyboard
// Simple controlled input that processes all characters immediately
const MobileInput = ({ onKeyPress, isFocused }) => {
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');

  // Auto-focus on mobile to show keyboard
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  const handleChange = (e) => {
    const newValue = e.target.value;

    // Process ALL new characters - fast typing needs this
    if (newValue.length > 0) {
      for (const char of newValue) {
        onKeyPress(char);
      }
      // Clear immediately after processing
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      onKeyPress('Backspace');
      setInputValue('');
    }
  };

  return (
    <div className="w-full flex justify-center mt-4 px-4">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        inputMode="text"
        enterKeyHint="done"
        placeholder="Tap here to type..."
        className="w-full max-w-md px-4 py-3 text-center text-lg bg-[var(--sub-color)] text-[var(--bg-color)] rounded-xl font-bold placeholder-[var(--bg-color)] opacity-80"
        style={{ fontSize: '16px' }}
      />
    </div>
  );
};

const TypingGame = ({ engine, uiOpacity, isFocused, otherUsers, session, handleKey, isMobile }) => {
  const { state, words, typed, timeLeft, wpm, rawWpm, accuracy, charStats, history, restart, setTimerDuration, setLanguage, language, timerDuration, setWords } = engine;
  const letterRefs = useRef({});
  const containerRef = useRef(null);
  const [lineOffset, setLineOffset] = useState(0);

  // 1. SYNC WORDS FROM SESSION - always use session words
  useEffect(() => {
    if (session.words) {
      setWords(session.words);
    }
  }, [session.words, setWords]);

  // Auto Scroll logic
  useEffect(() => {
    const currentIdx = typed.length;
    const currentLetter = letterRefs.current[currentIdx];
    if (currentLetter && containerRef.current) {
      const letterTop = currentLetter.offsetTop;
      // Use smaller line height on mobile
      const lineHeight = window.innerWidth < 768 ? 40 : 60;
      if (letterTop > lineHeight) setLineOffset(-(Math.floor(letterTop / lineHeight) * lineHeight));
      else setLineOffset(0);
    }
  }, [typed, words]);

  const getCaretPos = (index) => {
    const letter = letterRefs.current[index];
    if (!letter) return { left: 0, top: 10 };
    return { left: letter.offsetLeft - 2, top: letter.offsetTop + 8 };
  };

  const formatName = (name) => name ? name.toLowerCase() : "???";

  return (
    <>
      <div className="w-full max-w-6xl flex justify-end items-end px-10 mt-2 mb-8 select-none min-h-[60px]" style={{ opacity: uiOpacity }}>
        {state === "start" && (
          <div className="flex gap-6 text-[var(--sub-color)] text-sm font-bold bg-[rgba(0,0,0,0.1)] px-6 py-3 rounded-full items-center">
            <div className="flex gap-4 border-r-2 border-[var(--sub-color)] pr-6">
              <button onClick={() => setLanguage('p1')} className={`hover:text-[var(--text-color)] ${language === 'p1' ? "text-[var(--main-color)]" : ""}`}>{formatName(speakerNames.p1)}</button>
              <button onClick={() => setLanguage('p2')} className={`hover:text-[var(--text-color)] ${language === 'p2' ? "text-[var(--main-color)]" : ""}`}>{formatName(speakerNames.p2)}</button>
            </div>
            <div className="flex gap-3">
              {[15, 30, 60].map(t => (
                <button key={t} onClick={() => setTimerDuration(t)} className={`${timerDuration === t ? "text-[var(--main-color)]" : ""} hover:text-[var(--text-color)]`}>{t}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex-grow w-full max-w-5xl flex flex-col items-center justify-center relative">
        {/* 🏁 LIVE RACE STATS - Show during typing */}
        {state === "run" && (
          <div className="w-full mb-4 px-2">
            <div className="flex justify-between items-center mb-2">
              <div className="text-4xl font-bold text-[var(--main-color)]">{timeLeft}</div>
              <div className="text-sm text-[var(--sub-color)]">RACE IN PROGRESS</div>
            </div>

            {/* Progress bars */}
            <div className="space-y-2">
              {/* Your progress */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--main-color)] w-12">YOU</span>
                <div className="flex-1 h-3 bg-[rgba(0,0,0,0.2)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--main-color)] transition-all duration-100 rounded-full"
                    style={{ width: `${words ? (typed.length / words.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-[var(--main-color)] w-16 text-right">{wpm} WPM</span>
              </div>

              {/* Partner's progress */}
              {Object.keys(otherUsers).map(key => {
                const u = otherUsers[key];
                if (u.status !== 'typing' || !u.gameData) return null;
                const pProgress = u.gameData.progress || 0;
                const pWpm = u.gameData.wpm || 0;
                const isPrincess = u.role === 'princess';
                const pColor = isPrincess ? "#ff69b4" : "#e2b714";
                const label = isPrincess ? "HER" : "HIM";

                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs font-bold w-12" style={{ color: pColor }}>{label}</span>
                    <div className="flex-1 h-3 bg-[rgba(0,0,0,0.2)] rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-100 rounded-full"
                        style={{
                          width: `${words ? (pProgress / words.length) * 100 : 0}%`,
                          backgroundColor: pColor
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold w-16 text-right" style={{ color: pColor }}>{pWpm} WPM</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state !== "finish" ? (
          <div className="relative w-full h-[120px] md:h-[180px] overflow-hidden px-2 md:px-0">
            <motion.div animate={{ y: lineOffset }} transition={{ type: "spring", stiffness: 200, damping: 25 }} className="relative text-[18px] md:text-[32px] leading-[40px] md:leading-[60px] tracking-wide outline-none word-break-fix" ref={containerRef}>

              {/* MY CARET */}
              <motion.div className="absolute w-[2px] md:w-[3px] h-[28px] md:h-[45px] bg-[var(--caret-color)] rounded-full z-10" layoutId="caret" animate={{ left: getCaretPos(typed.length).left, top: getCaretPos(typed.length).top }} transition={{ type: "spring", stiffness: 400, damping: 28 }} />

              {/* 🔥 PARTNER'S GHOST CARET 🔥 */}
              {Object.keys(otherUsers).map(key => {
                const u = otherUsers[key];
                // Only show if they are playing typing game
                if (u.status !== 'typing' || !u.gameData) return null;

                const pIndex = u.gameData.progress || 0;
                const isPrincess = u.role === 'princess';
                const pColor = isPrincess ? "#ff69b4" : "#e2b714";
                const pos = getCaretPos(pIndex);

                return (
                  <motion.div
                    key={key}
                    className="absolute w-[1px] md:w-[2px] h-[28px] md:h-[40px] rounded-full z-5 opacity-50"
                    style={{ backgroundColor: pColor }}
                    animate={{ left: pos.left + 2, top: pos.top }}
                    transition={{ duration: 0.1 }}
                  >
                    {/* Label positioned to the left, not on top of text */}
                    <div
                      className="absolute -left-8 top-0 text-[8px] md:text-[9px] font-bold px-1 rounded-sm opacity-70 whitespace-nowrap"
                      style={{ color: pColor }}
                    >
                      {isPrincess ? "♡" : "★"}
                    </div>
                  </motion.div>
                );
              })}

              {(words || "").split("").map((char, i) => {
                let color = "text-[var(--sub-color)]";
                if (i < typed.length) color = typed[i] === char ? "text-[var(--text-color)]" : "text-[var(--error-color)]";
                return <span key={i} ref={(el) => (letterRefs.current[i] = el)} className={`${color} relative select-none`}>{char}</span>;
              })}
            </motion.div>
          </div>
        ) : (
          <div className="w-full animate-fade-in flex flex-col items-center">
            <div className="grid grid-cols-4 gap-4 w-full mb-8">
              <div className="flex flex-col"><div className="text-3xl text-[var(--sub-color)]">wpm</div><div className="text-8xl font-bold text-[var(--main-color)]">{wpm}</div></div>
              <div className="flex flex-col"><div className="text-3xl text-[var(--sub-color)]">acc</div><div className="text-8xl font-bold text-[var(--main-color)]">{accuracy}%</div></div>
              <div className="col-span-2 flex flex-col justify-center gap-2 pl-10 border-l border-[var(--sub-color)] border-opacity-20">
                <div className="flex justify-between border-b border-[var(--sub-color)] border-opacity-30 pb-1"><span className="text-[var(--sub-color)]">raw</span><span className="text-[var(--text-color)] font-bold text-xl">{rawWpm}</span></div>
              </div>
            </div>
            <div className="w-full h-64 mb-8 bg-[rgba(0,0,0,0.05)] rounded-xl p-4">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid strokeDasharray="3 3" stroke="var(--sub-color)" opacity={0.1} /><XAxis dataKey="time" stroke="var(--sub-color)" opacity={0.5} /><YAxis stroke="var(--sub-color)" opacity={0.5} domain={['dataMin', 'dataMax + 10']} /><Tooltip contentStyle={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--main-color)', color: 'var(--text-color)' }} /><Line type="monotone" dataKey="wpm" stroke="var(--main-color)" strokeWidth={3} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
            </div>
            <button onClick={restart} className="px-10 py-3 bg-[var(--sub-color)] hover:bg-[var(--text-color)] text-[var(--bg-color)] font-bold rounded-lg transition text-lg">Restart Test</button>
          </div>
        )}
      </div>

      {/* Mobile Input - triggers native iOS keyboard */}
      {isMobile && state !== "finish" && (
        <MobileInput onKeyPress={handleKey} isFocused={isFocused} />
      )}
    </>
  );
};

export default function App() {
  const engine = useEngine();
  const { session, updateSession, startNewGame } = useSession();
  const activeGame = session.mode;
  const theme = session.theme;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const isMobile = useIsMobile();

  // Sync Engine with Session Data
  useEffect(() => {
    engine.setLanguage(session.language);
    engine.setTimerDuration(session.timer);
  }, [session.language, session.timer]);

  // 🔥 2. BROADCAST LIVE GAME STATS 🔥
  // We send our typed length so partner can see our cursor
  const otherUsers = useMultiplayer(activeGame, {
    progress: engine.typed.length,
    wpm: engine.wpm
  });

  const switchGameGlobal = (mode) => {
    updateSession({ mode });
    setIsMenuOpen(false);

    // If switching to typing, generate NEW words for everyone
    if (mode === 'typing') {
      startNewGame(session.language);
    }
    engine.restart();
  };

  const switchThemeGlobal = (t) => updateSession({ theme: t });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); setIsMenuOpen(p => !p); if (engine.state === 'run') engine.restart(); return; }
      if (isMenuOpen || !isFocused || e.ctrlKey || e.metaKey) return;
      if (e.key === "Tab") {
        // Global Restart
        e.preventDefault();
        if (activeGame === 'typing') startNewGame(session.language); // Syncs new words
        engine.restart();
      }
      // Skip typing keys on mobile - MobileInput handles those
      if (isMobile && activeGame === "typing") return;
      if (activeGame === "typing" && (e.key.length === 1 || e.key === "Backspace")) engine.handleKey(e.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine.handleKey, engine.restart, isFocused, isMenuOpen, activeGame, engine.state, isMobile]);

  useEffect(() => {
    const onBlur = () => setIsFocused(false); const onFocus = () => setIsFocused(true);
    window.addEventListener("blur", onBlur); window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("blur", onBlur); window.removeEventListener("focus", onFocus); };
  }, []);

  return (
    <div className="h-screen w-full flex flex-col items-center font-mono transition-colors duration-500 overflow-hidden relative" data-theme={theme} style={{ backgroundColor: 'var(--bg-color)' }} onClick={() => setIsFocused(true)}>

      <FloatingParticles theme={theme} />
      <LiveCursor users={otherUsers} />

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-[rgba(0,0,0,0.8)] backdrop-blur-md flex items-center justify-center" onClick={() => setIsMenuOpen(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-[var(--bg-color)] p-8 rounded-xl border border-[var(--sub-color)] w-full max-w-lg shadow-2xl h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="text-[var(--sub-color)] text-xs font-bold uppercase mb-4 tracking-widest">Global Game Control</div>
              <div className="flex flex-col gap-2 mb-8">
                <button onClick={() => switchGameGlobal('typing')} className={`p-4 text-left rounded hover:bg-[var(--sub-color)] hover:text-[var(--bg-color)] transition ${activeGame === 'typing' ? 'bg-[var(--main-color)] text-[var(--bg-color)]' : 'text-[var(--text-color)]'}`}>⌨️ Typing Test (RACE)</button>
                <button onClick={() => switchGameGlobal('sky')} className={`p-4 text-left rounded hover:bg-[var(--sub-color)] hover:text-[var(--bg-color)] transition ${activeGame === 'sky' ? 'bg-[var(--main-color)] text-[var(--bg-color)]' : 'text-[var(--text-color)]'}`}>🌌 Night Sky</button>
                <button onClick={() => switchGameGlobal('memory')} className={`p-4 text-left rounded hover:bg-[var(--sub-color)] hover:text-[var(--bg-color)] transition ${activeGame === 'memory' ? 'bg-[var(--main-color)] text-[var(--bg-color)]' : 'text-[var(--text-color)]'}`}>🎲 Memory Lane</button>
                <button onClick={() => switchGameGlobal('quiz')} className={`p-4 text-left rounded hover:bg-[var(--sub-color)] hover:text-[var(--bg-color)] transition ${activeGame === 'quiz' ? 'bg-[var(--main-color)] text-[var(--bg-color)]' : 'text-[var(--text-color)]'}`}>🤔 Who Said It?</button>
                <button onClick={() => switchGameGlobal('archive')} className={`p-4 text-left rounded hover:bg-[var(--sub-color)] hover:text-[var(--bg-color)] transition ${activeGame === 'archive' ? 'bg-[var(--main-color)] text-[var(--bg-color)]' : 'text-[var(--text-color)]'}`}>🔍 Archive Search</button>
                <button onClick={() => switchGameGlobal('stats')} className={`p-4 text-left rounded hover:bg-[var(--sub-color)] hover:text-[var(--bg-color)] transition ${activeGame === 'stats' ? 'bg-[var(--main-color)] text-[var(--bg-color)]' : 'text-[var(--text-color)]'}`}>⚔️ Stats Battle</button>
                <button onClick={() => switchGameGlobal('boss')} className={`p-4 text-left rounded hover:bg-[var(--sub-color)] hover:text-[var(--bg-color)] transition ${activeGame === 'boss' ? 'bg-[var(--main-color)] text-[var(--bg-color)]' : 'text-[var(--text-color)]'}`}>👹 Boss Mode</button>
                <button onClick={() => switchGameGlobal('finish')} className={`p-4 text-left rounded hover:bg-[var(--sub-color)] hover:text-[var(--bg-color)] transition ${activeGame === 'finish' ? 'bg-[var(--main-color)] text-[var(--bg-color)]' : 'text-[var(--text-color)]'}`}>🧠 Finish Sentence</button>
                <button onClick={() => switchGameGlobal('letters')} className={`p-4 text-left rounded hover:bg-[var(--sub-color)] hover:text-[var(--bg-color)] transition border border-[var(--main-color)] ${activeGame === 'letters' ? 'bg-[var(--main-color)] text-[var(--bg-color)]' : 'text-[var(--main-color)]'}`}>💌 Unlockable Letters</button>
              </div>
              <div className="text-[var(--sub-color)] text-xs font-bold uppercase mb-4 tracking-widest">Global Theme</div>
              <div className="flex gap-2 mb-8">
                {['default', 'love', 'matrix'].map(t => <button key={t} onClick={() => switchThemeGlobal(t)} className={`px-4 py-2 rounded border border-[var(--sub-color)] hover:bg-[var(--main-color)] hover:border-[var(--main-color)] hover:text-[var(--bg-color)] capitalize text-[var(--text-color)] transition ${theme === t ? 'bg-[var(--sub-color)]' : ''}`}>{t}</button>)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-6xl flex justify-between items-center px-4 md:px-10 mt-4 md:mt-8 mb-2 md:mb-4">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={() => setIsMenuOpen(true)} className="text-[var(--sub-color)] hover:text-[var(--text-color)] transition"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
          <div className="text-lg md:text-2xl text-[var(--text-color)] font-bold">haizur type's</div>
        </div>
        <div className="text-[var(--main-color)] text-xs md:text-sm font-bold uppercase tracking-widest bg-[rgba(0,0,0,0.1)] px-2 md:px-3 py-1 rounded">
          {activeGame.toUpperCase()}
        </div>
      </div>

      <div className="flex-grow w-full flex flex-col items-center justify-center">
        {/* Pass otherUsers and session to ALL games for multiplayer */}
        {activeGame === 'typing' && <TypingGame engine={engine} uiOpacity={isMenuOpen ? 0 : 1} isFocused={isFocused} otherUsers={otherUsers} session={session} handleKey={engine.handleKey} isMobile={isMobile} />}
        {activeGame === 'quiz' && <Quiz theme={theme} otherUsers={otherUsers} session={session} updateSession={updateSession} />}
        {activeGame === 'archive' && <Archive theme={theme} otherUsers={otherUsers} />}
        {activeGame === 'memory' && <MemoryLane theme={theme} otherUsers={otherUsers} session={session} updateSession={updateSession} />}
        {activeGame === 'finish' && <FinishSentence theme={theme} otherUsers={otherUsers} session={session} updateSession={updateSession} />}
        {activeGame === 'stats' && <StatsBattle otherUsers={otherUsers} />}
        {activeGame === 'sky' && <NightSky otherUsers={otherUsers} />}
        {activeGame === 'boss' && <BossMode otherUsers={otherUsers} session={session} updateSession={updateSession} />}
        {activeGame === 'letters' && <LoveLetters otherUsers={otherUsers} />}
      </div>

      <div className="w-full max-w-6xl flex flex-col items-center gap-2 text-[var(--sub-color)] text-sm opacity-50 mb-6">
        <div className="flex gap-8"><div className="flex items-center gap-2"><span className="bg-[var(--sub-color)] text-[var(--bg-color)] px-2 py-0.5 rounded text-xs font-bold">tab</span> - restart</div><div className="flex items-center gap-2"><span className="bg-[var(--sub-color)] text-[var(--bg-color)] px-2 py-0.5 rounded text-xs font-bold">esc</span> - menu</div></div>
        <div className="text-[10px] mt-2 text-center max-w-xl opacity-70">i made this so my princess can have a cute little flashback on our old chats and rewind memories, while also improve her typing skills with her cute little fingers HAHAHA ILYSM &lt;33</div>
      </div>
    </div>
  );
}