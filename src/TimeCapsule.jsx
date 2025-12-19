import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { speakerNames } from "./words";
import { loadFullHistory } from "./dataLoader";

export default function TimeCapsule() {
  const [memories, setMemories] = useState([]);
  const [currentDate, setCurrentDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    // Get numeric day and month (pad with 0 if needed, e.g., "05")
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');

    // Format for display
    const options = { month: 'long', day: 'numeric' };
    setCurrentDate(today.toLocaleDateString('en-US', options));

    // Load data and filter
    loadFullHistory()
      .then(fullHistory => {
        if (!fullHistory) {
          setIsLoading(false);
          return;
        }

        // FILTER ENGINE
        // We look for messages where the date parts match today's Day/Month
        // Since formats vary (DD/MM vs MM/DD), we check if BOTH parts match in either order.
        const found = fullHistory.filter(msg => {
          if (!msg.date) return false;
          const { part1, part2 } = msg.date;

          // Check exact match (DD/MM or MM/DD)
          const match1 = (part1 === day && part2 === month);
          const match2 = (part1 === month && part2 === day);

          return match1 || match2;
        });

        setMemories(found);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load time capsule data:', err);
        setIsLoading(false);
      });
  }, []);

  const formatName = (key) => speakerNames[key] ? speakerNames[key].toLowerCase() : "???";

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center justify-center min-h-[500px]">
        <div className="text-[var(--main-color)] text-xl animate-pulse">Loading memories...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col items-center min-h-[500px] h-full">

      <div className="text-center mb-10 mt-6">
        <div className="text-[var(--sub-color)] uppercase tracking-widest text-xs font-bold mb-2">Time Machine</div>
        <h2 className="text-4xl font-bold text-[var(--main-color)]">On This Day: {currentDate}</h2>
        <p className="text-[var(--sub-color)] mt-2 opacity-70">
          {memories.length > 0 ? `We found ${memories.length} messages from the past.` : "No memories found for today in the chat history :("}
        </p>
      </div>

      <div className="w-full flex-grow overflow-y-auto px-4 pb-20 no-scrollbar">
        <div className="flex flex-col gap-4">
          {memories.map((msg, idx) => {
            const isMe = msg.speaker === 'p1';
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }} // Faster stagger
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full`}
              >
                <div className="text-[10px] text-[var(--sub-color)] mb-1 px-2 uppercase tracking-wider opacity-60">
                  {msg.date.raw} • {formatName(msg.speaker)}
                </div>
                <div
                  className={`
                                max-w-[80%] px-6 py-3 rounded-2xl text-lg relative
                                ${isMe
                      ? 'bg-[var(--main-color)] text-[var(--bg-color)] rounded-tr-none'
                      : 'bg-[rgba(0,0,0,0.1)] text-[var(--text-color)] border border-[var(--sub-color)] rounded-tl-none'
                    }
                            `}
                >
                  {msg.text}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}