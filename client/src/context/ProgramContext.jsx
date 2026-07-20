import { createContext, useContext } from 'react';

const ProgramContext = createContext(null);

export function useProgramContext() {
  const ctx = useContext(ProgramContext);
  if (!ctx) throw new Error('useProgramContext must be inside ProgramProvider');
  return ctx;
}

export function ProgramProvider({ children, program }) {
  const value = {
    id: program?.id || null,
    label: program?.label || null,
    type: program?.type || null,
    customName: program?.customName || null,
    category: program?.category || null,
    specialization: program?.specialization || null,
    cohort: program?.cohort || null,
    institution: program?.institution || null,
    isCustom: program?.type === 'custom',
    isPreset: program?.type === 'preset',
    ready: Boolean(program?.id),
  };

  return (
    <ProgramContext.Provider value={value}>
      {children}
    </ProgramContext.Provider>
  );
}
