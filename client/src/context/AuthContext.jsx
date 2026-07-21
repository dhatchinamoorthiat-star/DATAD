import { createContext, useContext, useState } from 'react';
import { jwtDecode } from 'jwt-decode';

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

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeProgram');
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dax:')) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    setToken(null);
  };

  const switchProgram = async (slug) => {
    const { default: axios } = await import('../api/axios');
    const res = await axios.post('/api/modules/switch', { slug });
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
