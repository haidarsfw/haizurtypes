import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { speakerNames } from "./words";
import { loadHistoryByDate } from "./dataLoader";

// Seeded random for sync
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export default function MemoryLane({ otherUsers = {}, session = {}, updateSession }) {
  const scrollRef = useRef(null);
  const [historyByDate, setHistoryByDate] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadHistoryByDate()
      .then(data => {
        setHistoryByDate(data || {});
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load history data:', err);
        setIsLoading(false);
      });
  }, []);

  // Use synced seed for same random date
  const seed = session.gameData?.memorySeed || Date.now();

  const { currentDate, messages } = useMemo(() => {
    const dates = Object.keys(historyByDate);
    if (dates.length === 0) return { currentDate: null, messages: [] };

    const randomIndex = Math.floor(seededRandom(seed) * dates.length);
    const date = dates[randomIndex];
    const daysMessages = historyByDate[date];

    // If day has very few messages, try next date
    if (daysMessages.length < 5 && dates.length > 1) {
      const retryIndex = Math.floor(seededRandom(seed + 1) * dates.length);
      const retryDate = dates[retryIndex];
      return { currentDate: retryDate, messages: historyByDate[retryDate] };
    }

    return { currentDate: date, messages: daysMessages };
  }, [seed, historyByDate]);

  // Auto-scroll to top when date changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentDate]);

  const pickRandomDate = () => {
    if (updateSession) {
      updateSession({
        gameData: {
          ...session.gameData,
          memorySeed: Date.now()
        }
      });
    }
  };

  const formatName = (key) => speakerNames[key] ? speakerNames[key].toLowerCase() : "???";

  // Get partner info
  const partner = Object.values(otherUsers).find(u => u.status === 'memory');

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center justify-center h-[500px]">
        <div className="text-[var(--main-color)] text-xl animate-pulse">Loading memories...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col items-center h-[500px] md:h-[600px] max-h-[70vh] md:max-h-[80vh] px-2 md:px-0">

      {/* Partner presence indicator */}
      {partner && (
        <div className="flex items-center gap-2 text-sm mb-4">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}
          />
          <span style={{ color: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}>
            {partner.role === 'princess' ? 'She' : 'He'}'s reading with you 💕
          </span>
        </div>
      )}

      {/* HEADER & REROLL BUTTON */}
      <div className="flex justify-between items-center w-full max-w-2xl mb-4 md:mb-6 px-2 md:px-4">
        <div className="flex flex-col">
          <span className="text-[var(--sub-color)] text-xs font-bold uppercase tracking-widest">Time Travel</span>
          <span className="text-lg md:text-2xl font-bold text-[var(--main-color)]">{currentDate || "Loading..."}</span>
        </div>
        <button
          onClick={pickRandomDate}
          className="px-4 md:px-6 py-2 bg-[var(--sub-color)] hover:bg-[var(--main-color)] text-[var(--bg-color)] font-bold rounded-lg transition text-sm md:text-base"
        >
          🎲 Random
        </button>
      </div>

      {/* CHAT CONTAINER (SCROLLABLE) */}
      <div
        ref={scrollRef}
        className="w-full max-w-2xl flex-grow overflow-y-auto px-6 py-8 bg-[rgba(0,0,0,0.05)] rounded-2xl border border-[var(--sub-color)] border-opacity-20 shadow-inner scrollbar-hide"
      >
        <div className="flex flex-col gap-3">
          {messages.map((msg, idx) => {
            const isMe = msg.speaker === 'p1';
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.01 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full`}
              >
                <div
                  className={`
                    max-w-[90%] md:max-w-[85%] px-4 md:px-5 py-2 md:py-3 rounded-2xl text-base md:text-lg relative leading-relaxed
                    ${isMe
                      ? 'bg-[var(--main-color)] text-[var(--bg-color)] rounded-tr-none'
                      : 'bg-[var(--bg-color)] text-[var(--text-color)] border border-[var(--sub-color)] border-opacity-30 rounded-tl-none shadow-sm'
                    }
                  `}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-[var(--sub-color)] mt-1 opacity-60 px-1">
                  {formatName(msg.speaker)}
                </span>
              </motion.div>
            );
          })}

          {/* End of chat marker */}
          <div className="text-center text-[var(--sub-color)] text-xs opacity-50 mt-8 mb-4">
            — End of conversation for {currentDate} —
          </div>
        </div>
      </div>
    </div>
  );
}