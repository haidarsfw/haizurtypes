import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { speakerNames } from "./words";
import { loadNightSkyData } from "./dataLoader";

export default function NightSky({ otherUsers = {} }) {
  const [hoveredStar, setHoveredStar] = useState(null);
  const [nightSkyData, setNightSkyData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadNightSkyData()
      .then(data => {
        setNightSkyData(data || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load night sky data:', err);
        setIsLoading(false);
      });
  }, []);

  // Generate random positions for stars once data is loaded
  const [stars, setStars] = useState([]);

  useEffect(() => {
    if (nightSkyData.length > 0) {
      setStars(
        nightSkyData.map((msg) => ({
          ...msg,
          x: Math.random() * 90 + 5, // 5% to 95% width
          y: Math.random() * 80 + 10, // 10% to 90% height
          size: Math.random() * 3 + 2, // 2px to 5px
          delay: Math.random() * 2
        }))
      );
    }
  }, [nightSkyData]);

  const formatName = (key) => speakerNames[key] ? speakerNames[key].toLowerCase() : "???";

  // Get partner info
  const partner = Object.values(otherUsers).find(u => u.status === 'sky');

  if (isLoading) {
    return (
      <div className="w-full h-[400px] md:h-[600px] flex items-center justify-center bg-gradient-to-b from-[#0f0c29] via-[#302b63] to-[#24243e] rounded-2xl md:rounded-3xl">
        <div className="text-white text-xl animate-pulse">Loading stars...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] md:h-[600px] relative overflow-hidden bg-gradient-to-b from-[#0f0c29] via-[#302b63] to-[#24243e] rounded-2xl md:rounded-3xl border border-[var(--sub-color)] border-opacity-30 shadow-2xl">

      {/* Partner presence indicator */}
      {partner && (
        <div className="absolute top-6 right-6 flex items-center gap-2 text-sm z-30">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}
          />
          <span style={{ color: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}>
            {partner.role === 'princess' ? 'She' : 'He'}'s stargazing with you ✨
          </span>
        </div>
      )}

      {/* Title */}
      <div className="absolute top-6 left-0 right-0 text-center pointer-events-none z-10 px-4">
        <h2 className="text-xl md:text-3xl font-bold text-white opacity-90 tracking-widest">NIGHT SKY</h2>
        <p className="text-xs md:text-sm text-white opacity-60">Tap a star to see late night talks</p>
      </div>

      {/* Stars */}
      {stars.map((star, idx) => (
        <motion.div
          key={idx}
          className="absolute rounded-full bg-white cursor-pointer hover:bg-[var(--main-color)] hover:shadow-[0_0_15px_var(--main-color)] transition-colors"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${Math.max(star.size * 2, 12)}px`,
            height: `${Math.max(star.size * 2, 12)}px`,
          }}
          initial={{ opacity: 0.2 }}
          animate={{ opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, delay: star.delay }}
          onMouseEnter={() => setHoveredStar(star)}
          onMouseLeave={() => setHoveredStar(null)}
          onClick={() => setHoveredStar(hoveredStar === star ? null : star)}
        />
      ))}

      {/* Tooltip Overlay */}
      <AnimatePresence>
        {hoveredStar && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center z-20 p-4 md:p-8"
            onClick={() => setHoveredStar(null)}
          >
            <div className="bg-[rgba(0,0,0,0.9)] backdrop-blur-md p-6 md:p-8 rounded-2xl border border-[var(--main-color)] max-w-md text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="text-[var(--main-color)] text-xs font-bold uppercase tracking-widest mb-2">
                {hoveredStar.date} • {hoveredStar.time}
              </div>
              <p className="text-white text-lg md:text-xl leading-relaxed font-medium">
                "{hoveredStar.text}"
              </p>
              <div className="mt-4 text-xs text-white opacity-50 uppercase">
                - {formatName(hoveredStar.speaker)}
              </div>
              <button
                className="mt-4 px-4 py-2 text-sm bg-[var(--main-color)] text-black rounded-lg font-bold md:hidden"
                onClick={() => setHoveredStar(null)}
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}