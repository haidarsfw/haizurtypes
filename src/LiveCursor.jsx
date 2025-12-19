import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const getModeName = (code) => {
  const map = {
    typing: "Typing Test", quiz: "Quiz", archive: "Archive", memory: "Memory Lane",
    finish: "Finish Sentence", stats: "Stats Battle", sky: "Night Sky", boss: "Boss Mode", letters: "Reading Letters"
  };
  return map[code] || "Menu";
};

// 👇 THE FIX IS HERE: Add " = {} " inside the parentheses
export default function LiveCursor({ users = {} }) {
  const userList = Object.keys(users || {}); // Extra safety check
  const isSheOnline = userList.length > 0;
  
  const partner = userList.length > 0 ? users[userList[0]] : null;

  return (
    <>
      {/* STATUS BADGE */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-3 bg-[rgba(0,0,0,0.8)] backdrop-blur-md px-4 py-3 rounded-xl border border-[var(--main-color)] border-opacity-30 shadow-2xl transition-all duration-500">
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${isSheOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
          {isSheOnline && <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75"></div>}
        </div>
        <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[var(--sub-color)] uppercase tracking-wider mb-0.5">
                {isSheOnline ? "ONLINE" : "OFFLINE"}
            </span>
            <div className="text-xs font-bold text-[var(--text-color)]">
                {isSheOnline 
                    ? (partner?.role === 'princess' 
                        ? `Princess is in ${getModeName(partner.status)}` 
                        : `My Prince is in ${getModeName(partner.status)}`)
                    : "Waiting for connection..."}
            </div>
        </div>
      </div>

      {/* GHOST CURSORS */}
      <AnimatePresence>
        {userList.map((userId) => {
            const user = users[userId];
            const isPrincess = user.role === 'princess';
            const label = isPrincess ? "Princess 👑" : "My Prince ⚔️";
            const color = isPrincess ? "#ff69b4" : "#e2b714"; 

            return (
            <motion.div
                key={userId}
                className="fixed z-50 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ left: `${user.x}%`, top: `${user.y}%`, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "tween", ease: "linear", duration: 0.1 }}
            >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="transform -translate-x-1 -translate-y-1 drop-shadow-lg">
                    <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19138L11.4818 12.3673H5.65376Z" fill={color} stroke="white" strokeWidth="2" />
                </svg>
                <div 
                    className="absolute left-5 top-5 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-md flex flex-col gap-0.5"
                    style={{ backgroundColor: color, color: isPrincess ? 'white' : 'black' }}
                >
                    <span>{label}</span>
                    <span className="opacity-80 font-normal text-[8px] uppercase">{getModeName(user.status)}</span>
                </div>
            </motion.div>
            );
        })}
      </AnimatePresence>
    </>
  );
}