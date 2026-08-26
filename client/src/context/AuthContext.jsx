import { createContext, useContext, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { registerUnauthorizedHandler } from '../api/axios';
import toast from '../utils/toast';

const AuthContext = createContext(null);

// What to say when the server ends a session, keyed on the `code` it sends
// (server/middleware/verifyToken.js). These are genuinely different events and
// a student can act on the difference: an evicted device means someone is
// using the account elsewhere, which is worth knowing. Codes without an entry
// — and plain expiry, which sends none — fall back to DEFAULT.
// Each entry takes the 401 body, so a message can quote server-supplied
// numbers (the device cap) rather than restating them from memory.
const SIGN_OUT_MESSAGE = {
  DEVICE_REVOKED: ({ maxDevices }) =>
    'Signed out because this account was signed in on another device'
    + (maxDevices ? ` — you can be signed in on ${maxDevices} at once` : ''),
  SESSION_UPGRADE_REQUIRED: () => 'Please sign in again to continue',
  DEFAULT: () => 'Your session expired — please sign in again',
};

const decodeUser = (token) => {
  if (!token) return null;
  try {
    const payload = jwtDecode(token);
    if (payload.exp * 1000 < Date.now()) return null;
    return {
      id: payload.userId,
      name: payload.name,
      email: payload.email,
      role: payload.role || 'member',
      tier: payload.tier || 'free',
      programs: payload.programs || ['general'],
      activeProgram: payload.activeProgram || 'general',
      // ProgramProvider reads this to drive the whole program UI; omitting it
      // here silently renders every program component as null.
      program: payload.program || null,
    };
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const user = decodeUser(token);

  // Returns the decoded account: the login response carries only a JWT, so
  // this is the one place that already knows the name to greet.
  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    const decoded = decodeUser(newToken);
    if (decoded) localStorage.setItem('activeProgram', decoded.activeProgram);
    setToken(newToken);
    return decoded;
  };

  // `reason: 'expired'` marks a forced logout (401 from an expired/revoked
  // JWT) so it can tell the user why they landed back on /login, as opposed
  // to a deliberate click on "Log out", which stays silent. `detail` is the
  // server's 401 body, when there was one.
  const logout = (reason, detail) => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeProgram');
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dax:')) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    setToken(null);

    if (reason === 'expired') {
      // Keyed on the code so two different sign-out reasons can't collapse
      // into one another's toast if they land close together.
      const code = detail?.code;
      const build = SIGN_OUT_MESSAGE[code] || SIGN_OUT_MESSAGE.DEFAULT;
      toast.warning(build(detail || {}), { id: `session:${code || 'expired'}` });
    }
  };

  // Any 401 on a non-auth endpoint means the 7-day JWT expired (or was
  // revoked) — drop the session so the app falls back to the login route
  // instead of rendering logged-in against an API that rejects every call.
  useEffect(() => {
    registerUnauthorizedHandler((detail) => logout('expired', detail));
    return () => registerUnauthorizedHandler(null);
  });

  const switchProgram = async (slug) => {
    const { default: axios } = await import('../api/axios');
    const res = await axios.post('/modules/switch', { slug });
    login(res.data.token);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, switchProgram }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
