import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { speakerNames } from "./words";
import { loadBossModeData } from "./dataLoader";

// Seeded random for sync
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export default function BossMode({ otherUsers = {}, session = {}, updateSession }) {
  const [bossIndex, setBossIndex] = useState(0);
  const [bossModeData, setBossModeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadBossModeData()
      .then(data => {
        setBossModeData(data || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load boss mode data:', err);
        setIsLoading(false);
      });
  }, []);

  // Get synced boss health from session
  const bossHealth = session.gameData?.bossHealth ?? 100;

  // Get current boss based on synced seed
  const currentBoss = useMemo(() => {
    if (!bossModeData || bossModeData.length === 0) return null;
    const seed = (session.gameData?.bossSeed || Date.now()) + bossIndex;
    const idx = Math.floor(seededRandom(seed) * bossModeData.length);
    return bossModeData[idx];
  }, [session.gameData?.bossSeed, bossIndex, bossModeData]);

  const spawnBoss = () => {
    if (updateSession) {
      updateSession({
        gameData: {
          ...session.gameData,
          bossSeed: Date.now(),
          bossHealth: 100
        }
      });
    }
    setBossIndex(i => i + 1);
  };

  // Attack boss (both players can attack!)
  const attackBoss = () => {
    const damage = Math.floor(Math.random() * 20) + 10; // 10-30 damage
    const newHealth = Math.max(0, bossHealth - damage);

    if (updateSession) {
      updateSession({
        gameData: {
          ...session.gameData,
          bossHealth: newHealth
        }
      });
    }

    // Auto spawn new boss if defeated
    if (newHealth <= 0) {
      setTimeout(() => spawnBoss(), 1500);
    }
  };

  // Initial Spawn
  useEffect(() => {
    if (!session.gameData?.bossSeed && !isLoading && bossModeData.length > 0) spawnBoss();
  }, [isLoading, bossModeData]);

  const formatName = (key) => speakerNames[key] ? speakerNames[key].toLowerCase() : "???";

  // Get partner info
  const partner = Object.values(otherUsers).find(u => u.status === 'boss');

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-[var(--main-color)] text-xl animate-pulse">Loading boss...</div>
      </div>
    );
  }

  if (!currentBoss) return <div className="text-center opacity-50 mt-20">No long messages found! Write more essays to each other.</div>;

  return (
    <div className="w-full max-w-3xl flex flex-col items-center min-h-[400px] md:min-h-[500px] px-4">
      {/* Partner presence indicator */}
      {partner && (
        <div className="flex items-center gap-2 text-sm mb-4">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}
          />
          <span style={{ color: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}>
            {partner.role === 'princess' ? 'She' : 'He'}'s fighting with you! ⚔️
          </span>
        </div>
      )}

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-[var(--error-color)] uppercase tracking-widest mb-2">👹 BOSS MODE</h2>
        <p className="text-[var(--sub-color)] text-sm">Co-op! Both players can attack!</p>
      </div>

      {/* Boss Health Bar */}
      <div className="w-full mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--error-color)] font-bold">BOSS HP</span>
          <span className="text-[var(--text-color)]">{bossHealth}/100</span>
        </div>
        <div className="h-4 bg-[rgba(0,0,0,0.2)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[var(--error-color)] rounded-full"
            initial={false}
            animate={{ width: `${bossHealth}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {bossHealth <= 0 && (
          <div className="text-center text-[var(--main-color)] font-bold mt-2 text-xl animate-pulse">
            🎉 BOSS DEFEATED! 🎉
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentBoss.text}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="bg-[rgba(0,0,0,0.05)] border-2 border-[var(--error-color)] border-opacity-30 p-8 rounded-xl shadow-lg relative w-full"
        >
          <div className="absolute top-0 left-0 bg-[var(--error-color)] text-[var(--bg-color)] text-xs font-bold px-3 py-1 rounded-br-lg uppercase">
            Lv. {currentBoss.text.length} Boss
          </div>

          <div className="mt-6 mb-6 text-lg leading-loose text-[var(--text-color)] font-medium whitespace-pre-wrap max-h-[400px] overflow-y-auto scrollbar-hide">
            {currentBoss.text}
          </div>

          <div className="flex justify-between items-end border-t border-[var(--sub-color)] border-opacity-20 pt-4">
            <div className="text-[var(--sub-color)] text-sm">
              <span className="font-bold text-[var(--main-color)] uppercase">{formatName(currentBoss.speaker)}</span>
              <span className="opacity-50 mx-2">•</span>
              <span className="opacity-50">{currentBoss.date || "Unknown Date"}</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-col md:flex-row gap-3 md:gap-4 mt-6 md:mt-8 w-full md:w-auto">
        <button
          onClick={attackBoss}
          disabled={bossHealth <= 0}
          className="px-6 md:px-8 py-3 md:py-4 bg-[var(--main-color)] hover:bg-[var(--text-color)] text-[var(--bg-color)] font-bold rounded-lg transition transform hover:scale-105 shadow-xl uppercase tracking-widest disabled:opacity-50 text-sm md:text-base"
        >
          ⚔️ Attack! (-10~30 HP)
        </button>
        <button
          onClick={spawnBoss}
          className="px-6 md:px-8 py-3 md:py-4 bg-[var(--error-color)] hover:bg-red-600 text-white font-bold rounded-lg transition transform hover:scale-105 shadow-xl uppercase tracking-widest text-sm md:text-base"
        >
          🔄 New Boss
        </button>
      </div>
    </div>
  );
}