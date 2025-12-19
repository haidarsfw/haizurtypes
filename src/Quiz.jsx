import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { speakerNames } from "./words";
import { loadRawChatData } from "./dataLoader";

// Seeded random for sync
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export default function Quiz({ theme, otherUsers = {}, session = {}, updateSession }) {
  const [gameState, setGameState] = useState("playing"); // playing, correct, wrong
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [rawChatData, setRawChatData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadRawChatData()
      .then(data => {
        setRawChatData(data || { p1: [], p2: [] });
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load quiz data:', err);
        setIsLoading(false);
      });
  }, []);

  // Generate questions from seed (synced with partner)
  const seed = session.gameData?.quizSeed || Date.now();

  const currentQuestion = useMemo(() => {
    if (!rawChatData) return null;

    const localSeed = seed + questionIndex;
    const speakers = ['p1', 'p2'];
    const randomSpeaker = speakers[Math.floor(seededRandom(localSeed) * speakers.length)];
    const messages = rawChatData[randomSpeaker];

    if (!messages || messages.length === 0) return null;

    const msgIndex = Math.floor(seededRandom(localSeed + 1) * messages.length);
    const randomText = messages[msgIndex];

    return { text: randomText, answer: randomSpeaker };
  }, [seed, questionIndex, rawChatData]);

  const nextQuestion = () => {
    setQuestionIndex(i => i + 1);
    setGameState("playing");
  };

  const handleGuess = (guess) => {
    if (gameState !== "playing") return;

    if (guess === currentQuestion?.answer) {
      setGameState("correct");
      setScore(s => s + 1);
      setStreak(s => s + 1);
      setTimeout(nextQuestion, 1000);
    } else {
      setGameState("wrong");
      setStreak(0);
      setTimeout(nextQuestion, 1500);
    }
  };

  const newGame = () => {
    if (updateSession) {
      updateSession({
        gameData: {
          ...session.gameData,
          quizSeed: Date.now()
        }
      });
    }
    setQuestionIndex(0);
    setScore(0);
    setStreak(0);
    setGameState("playing");
  };

  const getButtonColor = (speakerKey) => {
    if (gameState === "playing") return "bg-[var(--sub-color)] hover:bg-[var(--text-color)] text-[var(--bg-color)]";
    if (gameState === "correct") return speakerKey === currentQuestion?.answer ? "bg-[var(--main-color)] text-[var(--bg-color)] scale-110" : "opacity-20";
    if (gameState === "wrong") return speakerKey === currentQuestion?.answer ? "bg-[var(--main-color)] text-[var(--bg-color)]" : "bg-[var(--error-color)] text-white";
  };

  const formatName = (name) => name ? name.toLowerCase() : "???";

  // Get partner info
  const partner = Object.values(otherUsers).find(u => u.status === 'quiz');

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-[var(--main-color)] text-xl animate-pulse">Loading quiz...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px] px-4">
      {/* Partner presence indicator */}
      {partner && (
        <div className="absolute top-4 right-4 flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}
          />
          <span style={{ color: partner.role === 'princess' ? '#ff69b4' : '#e2b714' }}>
            {partner.role === 'princess' ? 'She' : 'He'}'s playing too!
          </span>
        </div>
      )}

      <div className="flex gap-6 md:gap-12 text-xl md:text-2xl font-bold mb-8 md:mb-16 text-[var(--sub-color)]">
        <div className="flex flex-col items-center"><span className="text-xs uppercase opacity-50">Score</span><span className="text-[var(--text-color)]">{score}</span></div>
        <div className="flex flex-col items-center"><span className="text-xs uppercase opacity-50">Streak</span><span className={`${streak > 2 ? 'text-[var(--main-color)]' : 'text-[var(--text-color)]'}`}>{streak}</span></div>
        <button
          onClick={newGame}
          className="text-xs px-3 py-1 bg-[var(--sub-color)] hover:bg-[var(--main-color)] text-[var(--bg-color)] rounded transition"
        >
          🔄 New Game
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion?.text}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
          className="text-3xl md:text-4xl text-center leading-relaxed font-medium text-[var(--text-color)] mb-20 px-8"
        >
          "{currentQuestion?.text}"
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full justify-center px-4">
        {['p1', 'p2'].map((key) => (
          <button key={key} onClick={() => handleGuess(key)} className={`px-8 md:px-12 py-4 md:py-6 rounded-xl text-lg md:text-xl font-bold transition-all duration-300 transform ${getButtonColor(key)}`}>
            {formatName(speakerNames[key])}
          </button>
        ))}
      </div>

      <div className="h-8 mt-12 font-bold text-xl">
        {gameState === "correct" && <span className="text-[var(--main-color)]">Correct!</span>}
        {gameState === "wrong" && <span className="text-[var(--error-color)]">Nope! It was {formatName(speakerNames[currentQuestion?.answer])}</span>}
      </div>
    </div>
  );
}