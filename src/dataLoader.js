// Data loader utility for lazy-loading chat data JSON files
// This prevents the massive JS bundle from crashing mobile Safari

// Cache for loaded data
const cache = {};

/**
 * Lazy-load data from JSON files
 * @param {string} dataName - Name of the data file (e.g., 'rawChatData', 'fullHistory')
 * @returns {Promise} - Promise that resolves to the loaded data
 */
export async function loadData(dataName) {
    if (cache[dataName]) {
        return cache[dataName];
    }

    try {
        const response = await fetch(`/data/${dataName}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load ${dataName}: ${response.status}`);
        }
        const data = await response.json();
        cache[dataName] = data;
        return data;
    } catch (error) {
        console.error(`Error loading ${dataName}:`, error);
        throw error;
    }
}

// Convenience loaders for specific data types
export const loadRawChatData = () => loadData('rawChatData');
export const loadFullHistory = () => loadData('fullHistory');
export const loadHistoryByDate = () => loadData('historyByDate');
export const loadNightSkyData = () => loadData('nightSkyData');
export const loadBossModeData = () => loadData('bossModeData');

// Check if data is already loaded
export const isDataLoaded = (dataName) => !!cache[dataName];

// Clear cache if needed
export const clearCache = (dataName) => {
    if (dataName) {
        delete cache[dataName];
    } else {
        Object.keys(cache).forEach(key => delete cache[key]);
    }
};
