import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { speakerNames } from "./words";
import { loadFullHistory } from "./dataLoader";

export default function Archive({ theme, otherUsers = {} }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [fullHistory, setFullHistory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadFullHistory()
      .then(data => {
        setFullHistory(data || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load archive data:', err);
        setIsLoading(false);
      });
  }, []);

  // Get partner info
  const partner = Object.values(otherUsers).find(u => u.status === 'archive');

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!fullHistory) {
      alert("Archive data is still loading. Please wait a moment.");
      return;
    }
    const found = fullHistory.filter(msg => msg.text.includes(query.toLowerCase())).slice(0, 50);
    setResults(found);
    setHasSearched(true);
  };

  const formatName = (key) => speakerNames[key] ? speakerNames[key].toLowerCase() : "???";

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl flex flex-col items-center justify-center min-h-[500px]">
        <div className="text-[var(--main-color)] text-xl animate-pulse">Loading archive...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col items-center min-h-[500px] h-full">
      {/* Partner presence indicator */}
      {partner && (
        <div className="flex items-center gap-2 text-sm mb-4">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}
          />
          <span style={{ color: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}>
            {partner.role === 'princess' ? 'She' : 'He'}'s searching too! 🔍
          </span>
        </div>
      )}
      <form onSubmit={handleSearch} className="w-full max-w-xl mb-8 relative z-10 mt-4">
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="search memory..."
          className="w-full bg-[rgba(0,0,0,0.1)] border-2 border-[var(--sub-color)] text-[var(--text-color)] px-6 py-4 rounded-full text-xl outline-none focus:border-[var(--main-color)] transition-colors placeholder-[var(--sub-color)] focus:bg-[var(--bg-color)]"
          autoFocus
        />
      </form>

      <div className="w-full flex-grow overflow-y-auto px-4 pb-20 no-scrollbar">
        {hasSearched && results.length === 0 && (
          <div className="text-center text-[var(--sub-color)] text-xl mt-10 opacity-50">no memories found for "{query}" :(</div>
        )}
        <div className="flex flex-col gap-4">
          {results.map((msg, idx) => {
            const isMe = msg.speaker === 'p1';
            return (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full`}>
                <div className="text-[10px] text-[var(--sub-color)] mb-1 px-2 uppercase tracking-wider opacity-60">{formatName(msg.speaker)}</div>
                <div className={`max-w-[80%] px-6 py-3 rounded-2xl text-lg ${isMe ? 'bg-[var(--main-color)] text-[var(--bg-color)] rounded-tr-none' : 'bg-[rgba(0,0,0,0.1)] text-[var(--text-color)] border border-[var(--sub-color)] rounded-tl-none'}`}>
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