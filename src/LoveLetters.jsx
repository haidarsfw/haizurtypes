import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// 👇 CUSTOMIZE YOUR LETTERS HERE!
// You can add as many as you want. Set the 'req' (Required WPM) higher for harder unlocks.
const LETTERS = [
  {
    id: 1,
    req: 10,
    title: "noob km",
    body: "ayoo pasti km bisa"
  },
  {
    id: 2,
    req: 30,
    title: "wow dik",
    body: "jujurly masih pelan sih tp aku sayang km bgt zura"
  },
  {
    id: 3,
    req: 50,
    title: "WHOAA",
    body: "km ngecit ya princess kok jago"
  },
  {
    id: 4,
    req: 70,
    title: "HAAH?!",
    body: "km kacau bgt sih sayang aku love km forever SAYAAAAAAAAAAAAANG"
  },
  {
    id: 5,
    req: 100,
    title: "GODLIKE",
    body: "100 WPM?! STOP! You're too powerful! Marry me right now. 💍"
  }
];

export default function LoveLetters({ otherUsers = {} }) {
  const [highScore, setHighScore] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState(null);

  // Get partner info
  const partner = Object.values(otherUsers).find(u => u.status === 'letters');

  // Load High Score from Local Storage
  useEffect(() => {
    const saved = localStorage.getItem("haizur_highscore") || 0;
    setHighScore(parseInt(saved));
  }, []);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center h-full min-h-[500px] p-8">
      {/* Partner presence indicator */}
      {partner && (
        <div className="flex items-center gap-2 text-sm mb-4">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}
          />
          <span style={{ color: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}>
            {partner.role === 'princess' ? 'She' : 'He'}'s reading letters too! 💕
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8 md:mb-12">
        <div className="text-[var(--sub-color)] uppercase tracking-widest text-xs font-bold mb-2">Secret Stash</div>
        <h2 className="text-2xl md:text-4xl font-bold text-[var(--main-color)]">Unlockable Letters</h2>
        <p className="text-[var(--sub-color)] mt-2 text-sm md:text-base">Your Best: <span className="text-[var(--text-color)] font-bold">{highScore} WPM</span></p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
        {LETTERS.map((letter) => {
          const isUnlocked = highScore >= letter.req;

          return (
            <motion.div
              key={letter.id}
              whileHover={isUnlocked ? { scale: 1.05 } : {}}
              whileTap={isUnlocked ? { scale: 0.95 } : {}}
              onClick={() => isUnlocked && setSelectedLetter(letter)}
              className={`
                relative h-40 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all shadow-lg overflow-hidden
                ${isUnlocked
                  ? "bg-[var(--bg-color)] border-[var(--main-color)]"
                  : "bg-[rgba(0,0,0,0.1)] border-[var(--sub-color)] border-opacity-30 cursor-not-allowed grayscale"
                }
              `}
            >
              {/* Icon */}
              <div className="text-4xl mb-2">
                {isUnlocked ? "💌" : "🔒"}
              </div>

              {/* Text */}
              <div className="text-center z-10">
                <div className={`font-bold ${isUnlocked ? "text-[var(--text-color)]" : "text-[var(--sub-color)]"}`}>
                  {isUnlocked ? letter.title : "Locked"}
                </div>
                {!isUnlocked && (
                  <div className="text-xs text-[var(--sub-color)] mt-1">Requires {letter.req} WPM</div>
                )}
              </div>

              {/* Shine Effect if unlocked */}
              {isUnlocked && (
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[rgba(255,255,255,0.1)] to-transparent opacity-50" />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* READING MODAL */}
      <AnimatePresence>
        {selectedLetter && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.8)] backdrop-blur-sm"
            onClick={() => setSelectedLetter(null)}
          >
            <motion.div
              initial={{ scale: 0.5, y: 100, rotateX: 90 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-[#fff0f5] text-[#59404c] p-10 rounded-xl max-w-lg w-full shadow-2xl relative border-4 border-[var(--main-color)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <span className="text-5xl">💌</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-[#ff5c8d] text-center">{selectedLetter.title}</h3>
              <p className="text-lg leading-relaxed font-medium font-serif text-center">
                "{selectedLetter.body}"
              </p>
              <button
                onClick={() => setSelectedLetter(null)}
                className="mt-8 w-full py-3 bg-[#ff5c8d] text-white font-bold rounded-lg hover:bg-[#ff3366] transition"
              >
                Close Letter
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}