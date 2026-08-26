// Throwaway config so the capture run can start its own vite without touching
// the shared node_modules/.vite cache, which another account owns.
import base from './vite.config.js';

export default { ...base, cacheDir: process.env.PITCH_VITE_CACHE };
