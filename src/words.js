// Minimal words.js - Only contains speakerNames and generateWords
// Large data (rawChatData, fullHistory, etc.) has been moved to public/data/*.json
// Use dataLoader.js to lazy-load that data when needed

export const speakerNames = { p1: "dar", p2: "azhura" };

// Generate typing test words from chat data
// This function now loads data dynamically
let cachedWords = { p1: [], p2: [] };
let dataLoaded = false;

// Initialize words cache from data files
async function loadWordsCache() {
  if (dataLoaded) return;

  try {
    const response = await fetch('/data/rawChatData.json');
    const rawChatData = await response.json();
    cachedWords = rawChatData;
    dataLoaded = true;
  } catch (error) {
    console.error('Failed to load words data:', error);
    // Provide fallback words if loading fails
    cachedWords = {
      p1: ["hello", "world", "typing", "test", "sample", "words"],
      p2: ["hello", "world", "typing", "test", "sample", "words"]
    };
    dataLoaded = true;
  }
}

// Pre-load words data
loadWordsCache();

export const generateWords = (lang = "p1", count = 25) => {
  const words = cachedWords[lang] || cachedWords.p1 || [];
  if (words.length === 0) {
    // Return fallback if data not loaded yet
    return "loading words please wait...".split(" ").join(" ");
  }

  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).join(" ");
};
