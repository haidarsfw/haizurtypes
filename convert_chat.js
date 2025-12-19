import fs from 'fs';

const CHAT_FILE = '_chat.txt';
const SYSTEM_MESSAGES = [
  "omitted", "this message was deleted", "missed voice call", 
  "missed video call", "messages and calls are end-to-end encrypted",
  "waiting for this message", "security code changed", "null"
];

try {
  console.log("📖 Reading chat history...");
  const data = fs.readFileSync(CHAT_FILE, 'utf8');
  const lines = data.split(/\r?\n/);

  // 1. SCAN FOR NAMES
  const nameCounts = {};
  lines.forEach(line => {
    let match = line.match(/^\[.*?\] (.*?): (.*)$/);
    if (!match) match = line.match(/^.*? - (.*?): (.*)$/);
    if (match) {
      const name = match[1].trim();
      nameCounts[name] = (nameCounts[name] || 0) + 1;
    }
  });

  const sortedNames = Object.keys(nameCounts).sort((a, b) => nameCounts[b] - nameCounts[a]);
  if (sortedNames.length < 2) throw new Error("Need 2 people! Check _chat.txt format.");

  const personA = sortedNames[0]; 
  const personB = sortedNames[1];
  console.log(`✨ DETECTED: ${personA} & ${personB}`);

  // 2. PARSE DATA
  const collections = { [personA]: [], [personB]: [] };
  const historyByDate = {}; 
  const fullHistory = []; 
  const nightSky = []; 
  const bossMode = []; 

  const cleanMessage = (msg) => {
    let clean = msg.toLowerCase();
    if (SYSTEM_MESSAGES.some(sys => clean.includes(sys))) return null;
    if (clean.includes("http")) return null;
    clean = clean.replace(/[^a-z0-9 .,?!'@#-]/g, '');
    clean = clean.trim();
    if (clean.length < 2 && !['i', 'u', 'y'].includes(clean)) return null;
    return clean;
  };

  // UPDATED: Handles "17.21" AND "17:21"
  const isLateNight = (timeStr) => {
    if (!timeStr) return false;
    
    // Look for digits followed by a colon OR a dot
    const match = timeStr.match(/(\d+)[:.](\d+)/);
    if (!match) return false;
    
    let hour = parseInt(match[1]);
    
    // Handle AM/PM if present
    const isPM = timeStr.toLowerCase().includes('pm');
    const isAM = timeStr.toLowerCase().includes('am');
    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;

    // Late night = 11 PM (23) to 5 AM (5)
    return (hour >= 23 || hour < 5);
  };

  lines.forEach(line => {
    let match = line.match(/^\[(.*?)\] (.*?): (.*)$/);
    if (!match) match = line.match(/^(.*?) - (.*?): (.*)$/);

    if (match) {
      const timestamp = match[1]; 
      const dateRaw = timestamp.split(',')[0].trim();
      // Robust time grabber
      const timeRaw = timestamp.split(',')[1] || timestamp.split(' ')[1] || ''; 
      
      const name = match[2].trim();
      const content = match[3];
      const cleaned = cleanMessage(content);

      if (cleaned) {
        const speakerKey = name === personA ? 'p1' : 'p2';

        // 1. Typing Game
        if (name === personA) collections[personA].push(cleaned);
        else if (name === personB) collections[personB].push(cleaned);

        // 2. Archive
        fullHistory.push({ speaker: speakerKey, text: cleaned });

        // 3. Memory Lane
        if (!historyByDate[dateRaw]) historyByDate[dateRaw] = [];
        historyByDate[dateRaw].push({
            speaker: speakerKey, text: content, time: timeRaw
        });

        // 4. Night Sky (Now supports 17.00 format)
        if (isLateNight(timeRaw)) {
            nightSky.push({ speaker: speakerKey, text: content, time: timeRaw, date: dateRaw });
        }

        // 5. Boss Mode
        if (content.length > 200 || content.split(' ').length > 40) {
            if (!SYSTEM_MESSAGES.some(sys => content.toLowerCase().includes(sys))) {
                bossMode.push({ speaker: speakerKey, text: content, date: dateRaw });
            }
        }
      }
    }
  });

  const shuffle = (array) => array.sort(() => Math.random() - 0.5);
  const listA = shuffle(collections[personA]).slice(0, 2500);
  const listB = shuffle(collections[personB]).slice(0, 2500);

  const fileContent = `
export const speakerNames = { p1: ${JSON.stringify(personA)}, p2: ${JSON.stringify(personB)} };
export const rawChatData = { p1: ${JSON.stringify(listA)}, p2: ${JSON.stringify(listB)} };
export const fullHistory = ${JSON.stringify(fullHistory)};
export const historyByDate = ${JSON.stringify(historyByDate)};
export const nightSkyData = ${JSON.stringify(shuffle(nightSky).slice(0, 300))}; 
export const bossModeData = ${JSON.stringify(shuffle(bossMode).slice(0, 100))}; 

export const generateWords = (lang = "p1", count = 25) => {
  const list = rawChatData[lang] || rawChatData['p1'];
  if (!list || list.length === 0) return "no messages found";
  return Array.from({length: count}, () => list[Math.floor(Math.random() * list.length)]).join(' '); 
};
`;

  fs.writeFileSync('src/words.js', fileContent);
  console.log(`✅ DATA READY: Found ${nightSky.length} stars & ${bossMode.length} boss messages!`);

} catch (err) {
  console.error("❌ Error:", err.message);
}