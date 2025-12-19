import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { speakerNames } from "./words";
import { loadFullHistory } from "./dataLoader";

// Fun words to auto-suggest
const RANDOM_WORDS = [
    "love", "sorry", "miss", "haha", "lol", "sleep", "hungry",
    "ok", "no", "yes", "please", "happy", "sad", "work", "busy",
    "food", "goodnight", "morning", "home", "wait"
];

export default function StatsBattle({ otherUsers = {} }) {
    const [query, setQuery] = useState("");
    const [stats, setStats] = useState(null); // { p1: 10, p2: 5, term: "love" }
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
                console.error('Failed to load stats data:', err);
                setIsLoading(false);
            });
    }, []);

    // Get partner info
    const partner = Object.values(otherUsers).find(u => u.status === 'stats');

    const calculateStats = (searchTerm) => {
        if (!searchTerm.trim()) return;
        if (!fullHistory) return;

        let countP1 = 0;
        let countP2 = 0;

        // Normalize search
        const term = searchTerm.toLowerCase().trim();

        fullHistory.forEach(msg => {
            // We use a simple check. If you want exact words only, we'd need Regex.
            // "Includes" allows finding "love" inside "loveyou" or "loved", which is usually better.
            // We count OCCURRENCES (so "haha haha" counts as 1 message usually, but let's count mentions)

            const text = msg.text;
            if (text.includes(term)) {
                // Simple occurrence check (1 per message to avoid skewing data with spam)
                if (msg.speaker === 'p1') countP1++;
                else countP2++;
            }
        });

        setStats({ p1: countP1, p2: countP2, term });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        calculateStats(query);
    };

    const handleRandom = () => {
        const randomWord = RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)];
        setQuery(randomWord);
        calculateStats(randomWord);
    };

    const getTotal = () => (stats ? stats.p1 + stats.p2 : 0);
    const getPercent = (val) => {
        const total = getTotal();
        if (total === 0) return 0;
        return Math.round((val / total) * 100);
    };

    const formatName = (key) => speakerNames[key] ? speakerNames[key].toLowerCase() : "???";

    if (isLoading) {
        return (
            <div className="w-full max-w-4xl flex flex-col items-center justify-center min-h-[500px]">
                <div className="text-[var(--main-color)] text-xl animate-pulse">Loading stats...</div>
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
                        {partner.role === 'princess' ? 'She' : 'He'}'s comparing stats too! 📊
                    </span>
                </div>
            )}

            {/* SEARCH BAR */}
            <div className="w-full max-w-xl mb-12 relative z-10 mt-8 flex flex-col gap-4">
                <form onSubmit={handleSearch} className="w-full relative">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="compare a word (e.g. 'sorry')..."
                        className="w-full bg-[rgba(0,0,0,0.1)] border-2 border-[var(--sub-color)] text-[var(--text-color)] px-6 py-4 rounded-full text-xl outline-none focus:border-[var(--main-color)] transition-colors placeholder-[var(--sub-color)] focus:bg-[var(--bg-color)]"
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="absolute right-3 top-2 bottom-2 px-6 bg-[var(--sub-color)] hover:bg-[var(--main-color)] text-[var(--bg-color)] font-bold rounded-full transition-colors"
                    >
                        Fight
                    </button>
                </form>
                <button
                    onClick={handleRandom}
                    className="self-center text-[var(--sub-color)] text-sm hover:text-[var(--main-color)] transition flex items-center gap-2"
                >
                    🎲 Try a random common word
                </button>
            </div>

            {/* BATTLE ARENA */}
            {stats && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-2xl bg-[rgba(0,0,0,0.05)] rounded-3xl p-8 border border-[var(--sub-color)] border-opacity-20"
                >
                    <div className="text-center mb-10">
                        <div className="text-[var(--sub-color)] uppercase tracking-widest text-xs font-bold mb-2">Verdict</div>
                        <h2 className="text-4xl font-bold text-[var(--text-color)]">
                            Who says "<span className="text-[var(--main-color)]">{stats.term}</span>" more?
                        </h2>
                    </div>

                    {getTotal() === 0 ? (
                        <div className="text-center text-[var(--sub-color)] opacity-50">
                            Neither of you have said this word yet!
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {/* PLAYER 1 BAR */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-xl font-bold px-2">
                                    <span className="text-[var(--main-color)]">{formatName('p1')}</span>
                                    <span className="text-[var(--text-color)]">{stats.p1} times</span>
                                </div>
                                <div className="w-full h-12 bg-[var(--bg-color)] rounded-full overflow-hidden border border-[var(--sub-color)] border-opacity-30 relative">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${getPercent(stats.p1)}%` }}
                                        transition={{ duration: 1, type: "spring" }}
                                        className="h-full bg-[var(--main-color)]"
                                    />
                                    <span className="absolute inset-0 flex items-center ml-4 text-[var(--bg-color)] font-bold opacity-80">{getPercent(stats.p1)}%</span>
                                </div>
                            </div>

                            {/* PLAYER 2 BAR */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-xl font-bold px-2">
                                    <span className="text-[var(--sub-color)]">{formatName('p2')}</span>
                                    <span className="text-[var(--text-color)]">{stats.p2} times</span>
                                </div>
                                <div className="w-full h-12 bg-[var(--bg-color)] rounded-full overflow-hidden border border-[var(--sub-color)] border-opacity-30 relative">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${getPercent(stats.p2)}%` }}
                                        transition={{ duration: 1, type: "spring" }}
                                        className="h-full bg-[var(--sub-color)]"
                                    />
                                    <span className="absolute inset-0 flex items-center ml-4 text-[var(--bg-color)] font-bold opacity-80">{getPercent(stats.p2)}%</span>
                                </div>
                            </div>

                            {/* WINNER MESSAGE */}
                            <div className="text-center mt-6 text-lg font-bold">
                                {stats.p1 > stats.p2 ? (
                                    <span>🏆 {formatName('p1')} wins the <span className="text-[var(--main-color)]">{stats.term}</span> war!</span>
                                ) : stats.p2 > stats.p1 ? (
                                    <span>🏆 {formatName('p2')} wins the <span className="text-[var(--main-color)]">{stats.term}</span> war!</span>
                                ) : (
                                    <span>It's a tie! Soulmates fr.</span>
                                )}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}