import React from "react";
import { motion } from "framer-motion";
import { useMultiplayer } from "./hooks/useMultiplayer";

export default function LiveCursor() {
  const otherUsers = useMultiplayer();
  const userCount = Object.keys(otherUsers).length;
  const isSheOnline = userCount > 0;

  return (
    <>
      {/* STATUS BADGE */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-3 bg-[rgba(0,0,0,0.6)] backdrop-blur-md px-4 py-2 rounded-full border border-[var(--sub-color)] border-opacity-30 pointer-events-none">
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${isSheOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
          {isSheOnline && (
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75"></div>
          )}
        </div>
        <div className="text-xs font-bold text-[var(--text-color)] uppercase tracking-wider">
          {isSheOnline ? "She is here! ❤️" : "Waiting for her..."}
        </div>
      </div>

      {/* GHOST CURSORS */}
      {Object.keys(otherUsers).map((userId) => {
        const user = otherUsers[userId];
        return (
          <motion.div
            key={userId}
            className="fixed z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ left: `${user.x}%`, top: `${user.y}%`, opacity: 1 }}
            transition={{ type: "tween", ease: "linear", duration: 0.1 }}
          >
            {/* CURSOR SVG */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transform -translate-x-1 -translate-y-1">
              <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19138L11.4818 12.3673H5.65376Z" fill="var(--main-color)" stroke="var(--bg-color)" strokeWidth="2" />
            </svg>
            <div className="absolute left-4 top-4 px-2 py-1 rounded bg-[var(--main-color)] text-[var(--bg-color)] text-[10px] font-bold whitespace-nowrap">
                Princess 👑
            </div>
          </motion.div>
        );
      })}
    </>
  );
}