import { useState, useMemo } from 'react';
import { Search, Sparkles } from 'lucide-react';

const PRESET_PROGRAMS = [
  { id: 'mba', label: 'MBA', icon: '📊', category: 'Master' },
  { id: 'btech-cs', label: 'BTech Computer Science', icon: '💻', category: 'Bachelor' },
  { id: 'bsc-psychology', label: 'BSc Psychology', icon: '🧠', category: 'Bachelor' },
  { id: 'msc-ds', label: 'MSc Data Science', icon: '📈', category: 'Master' },
  { id: 'bvsc', label: 'BVSc Veterinary Science', icon: '🐾', category: 'Bachelor' },
  { id: 'llb', label: 'LLB Law', icon: '⚖️', category: 'Bachelor' },
  { id: 'bdes-fashion', label: 'BDes Fashion Design', icon: '👗', category: 'Bachelor' },
  { id: 'msc-cs', label: 'MSc Computer Science', icon: '🖥️', category: 'Master' },
  { id: 'ba-economics', label: 'BA Economics', icon: '💹', category: 'Bachelor' },
  { id: 'beng-mechanical', label: 'BEng Mechanical Engineering', icon: '⚙️', category: 'Bachelor' },
];

export function ProgramSelector({ onSelect, loading = false }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return PRESET_PROGRAMS;
    return PRESET_PROGRAMS.filter(
      (p) => p.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const showCustomOption =
    search.trim() &&
    !PRESET_PROGRAMS.some((p) => p.id === search.toLowerCase());

  const handleSelectPreset = (program) => {
    setSelectedId(program.id);
    onSelect({
      id: program.id,
      label: program.label,
      type: 'preset',
    });
  };

  const handleSelectCustom = () => {
    const customId = `custom-${Date.now()}`;
    setSelectedId(customId);
    onSelect({
      id: customId,
      label: search.trim(),
      type: 'custom',
      customName: search.trim(),
    });
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          What's your program?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Everything in DATAD will be tailored to your degree
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search or type your degree..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Preset Programs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map((program) => (
          <button
            key={program.id}
            onClick={() => handleSelectPreset(program)}
            disabled={loading}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedId === program.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-3xl mb-2">{program.icon}</div>
            <div className="font-semibold text-sm text-gray-900 dark:text-white text-left">
              {program.label}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-left mt-1">
              {program.category}
            </div>
          </button>
        ))}
      </div>

      {/* Custom Program Option */}
      {showCustomOption && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Not finding your program?
          </p>
          <button
            onClick={handleSelectCustom}
            disabled={loading}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Use "{search.trim()}" as my program
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Custom programs get full personalization after admin verification
          </p>
        </div>
      )}

      {/* No Results */}
      {filtered.length === 0 && !showCustomOption && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-3">No programs found</p>
          <button
            onClick={() => setSearch('')}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Info */}
      {!search && (
        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 Once selected, your entire DATAD experience—news, companies, career paths,
            community, and study materials—will be customized for your program.
          </p>
        </div>
      )}
    </div>
  );
}
