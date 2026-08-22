import { createContext, useContext, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { registerUnauthorizedHandler } from '../api/axios';
import toast from '../utils/toast';

const AuthContext = createContext(null);

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

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    const decoded = decodeUser(newToken);
    if (decoded) localStorage.setItem('activeProgram', decoded.activeProgram);
    setToken(newToken);
  };

  // `reason: 'expired'` marks a forced logout (401 from an expired/revoked
  // JWT) so it can tell the user why they landed back on /login, as opposed
  // to a deliberate click on "Log out", which stays silent.
  const logout = (reason) => {
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
      toast.warning('Your session expired — please sign in again', { id: 'session:expired' });
    }
  };

  // Any 401 on a non-auth endpoint means the 7-day JWT expired (or was
  // revoked) — drop the session so the app falls back to the login route
  // instead of rendering logged-in against an API that rejects every call.
  useEffect(() => {
    registerUnauthorizedHandler(() => logout('expired'));
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
