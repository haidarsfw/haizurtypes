import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { speakerNames } from "./words";
import { loadRawChatData } from "./dataLoader";

// Seeded random for sync
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export default function FinishSentence({ otherUsers = {}, session = {}, updateSession }) {
  const [gameState, setGameState] = useState("playing"); // playing, correct, wrong
  const [score, setScore] = useState(0);
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
        console.error('Failed to load chat data:', err);
        setIsLoading(false);
      });
  }, []);

  // Use synced seed for same questions
  const seed = session.gameData?.finishSeed || Date.now();

  const { question, options } = useMemo(() => {
    if (!rawChatData) return { question: null, options: [] };

    const localSeed = seed + questionIndex;

    // Pick a speaker
    const speakerKey = seededRandom(localSeed) > 0.5 ? 'p1' : 'p2';
    const messages = rawChatData[speakerKey];

    if (!messages || messages.length === 0) return { question: null, options: [] };

    // Find a "long" message (> 5 words) using seeded random
    let validMsg = null;
    let attempts = 0;
    while (!validMsg && attempts < 50) {
      const idx = Math.floor(seededRandom(localSeed + attempts) * messages.length);
      const r = messages[idx];
      if (r && r.split(' ').length >= 5) validMsg = r;
      attempts++;
    }

    if (!validMsg) return { question: null, options: [] };

    // Split it
    const words = validMsg.split(' ');
    const cutPoint = Math.floor(words.length * 0.6);
    const startText = words.slice(0, cutPoint).join(' ');
    const endText = words.slice(cutPoint).join(' ');

    // Generate Decoys (Wrong answers)
    const decoys = [];
    let decoyAttempt = 0;
    while (decoys.length < 3 && decoyAttempt < 20) {
      const idx = Math.floor(seededRandom(localSeed + 100 + decoyAttempt) * messages.length);
      const r = messages[idx];
      if (r) {
        const rWords = r.split(' ');
        const rEnd = rWords.slice(Math.floor(rWords.length * 0.5)).join(' ');
        if (rEnd !== endText && rEnd.length > 3 && !decoys.includes(rEnd)) {
          decoys.push(rEnd);
        }
      }
      decoyAttempt++;
    }

    // Shuffle Options using seeded random
    const allOptions = [...decoys, endText];
    for (let i = allOptions.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(localSeed + 200 + i) * (i + 1));
      [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }

    return {
      question: { speaker: speakerKey, start: startText, answer: endText },
      options: allOptions
    };
  }, [seed, questionIndex, rawChatData]);

  const nextQuestion = () => {
    setQuestionIndex(i => i + 1);
    setGameState("playing");
  };

  const handleGuess = (opt) => {
    if (gameState !== "playing") return;
    if (opt === question?.answer) {
      setGameState("correct");
      setScore(s => s + 1);
      setTimeout(nextQuestion, 1500);
    } else {
      setGameState("wrong");
      setTimeout(nextQuestion, 2000);
    }
  };

  const newGame = () => {
    if (updateSession) {
      updateSession({
        gameData: {
          ...session.gameData,
          finishSeed: Date.now()
        }
      });
    }
    setQuestionIndex(0);
    setScore(0);
    setGameState("playing");
  };

  const formatName = (key) => speakerNames[key] ? speakerNames[key].toLowerCase() : "???";

  // Get partner info
  const partner = Object.values(otherUsers).find(u => u.status === 'finish');

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-[var(--main-color)] text-xl animate-pulse">Loading game...</div>
      </div>
    );
  }

  if (!question) return <div>Loading...</div>;

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

      <div className="text-[var(--sub-color)] uppercase tracking-widest text-xs font-bold mb-6 md:mb-10 flex flex-wrap gap-2 md:gap-6 items-center justify-center">
        <span>Score: {score}</span>
        <span>•</span>
        <span>Finish for <span className="text-[var(--main-color)]">{formatName(question.speaker)}</span></span>
        <button
          onClick={newGame}
          className="px-3 py-1 bg-[var(--sub-color)] hover:bg-[var(--main-color)] text-[var(--bg-color)] rounded transition"
        >
          🔄 New
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.start}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-xl md:text-3xl text-center font-medium text-[var(--text-color)] mb-8 md:mb-12 px-2"
        >
          "{question.start}..."
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => handleGuess(opt)}
            disabled={gameState !== "playing"}
            className={`
              px-6 py-4 rounded-xl text-lg font-bold transition-all duration-300 text-left truncate
              ${gameState === "playing" ? "bg-[var(--sub-color)] text-[var(--bg-color)] hover:bg-[var(--text-color)]" : ""}
              ${gameState !== "playing" && opt === question.answer ? "bg-[var(--main-color)] text-white" : ""}
              ${gameState === "wrong" && opt !== question.answer ? "opacity-30" : ""}
            `}
          >
            ...{opt}
          </button>
        ))}
      </div>

      <div className="h-8 mt-8 font-bold text-xl">
        {gameState === "correct" && <span className="text-[var(--main-color)]">Correct!</span>}
        {gameState === "wrong" && <span className="text-[var(--error-color)]">Wrong! It was "...{question.answer}"</span>}
      </div>
    </div>
  );
}