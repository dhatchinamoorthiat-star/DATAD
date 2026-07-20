import { useEffect, useState } from 'react';
import { Zap, Check } from 'lucide-react';
import { getAvailableModels, getModelPreference, setModelPreference } from '../../../api/dax.js';
import { useSubscription } from '../../../context/SubscriptionContext';

export default function ModelSelector() {
  const { tier } = useSubscription();
  const [models, setModels] = useState([]);
  const [preference, setPreference] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [modelsRes, prefRes] = await Promise.all([getAvailableModels(), getModelPreference()]);
        setModels(modelsRes.data?.models || []);
        setPreference(prefRes.data?.model);
      } catch (err) {
        console.error('Failed to load models:', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelect = async (modelId) => {
    try {
      await setModelPreference(modelId);
      setPreference(modelId);
    } catch (err) {
      console.error('Failed to set model preference:', err.message);
    }
  };

  if (loading || !models.length) return null;

  // Group by tier recommendation
  const tierDefaults = {
    free: 'meta/llama-3.1-8b-instruct',
    trial: 'meta/llama-3.1-8b-instruct',
    pro: 'deepseek-ai/deepseek-v4-flash',
    max: 'deepseek-ai/deepseek-v4-pro',
  };

  const recommended = tierDefaults[tier];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Chat Model</h3>
        <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          Your Tier
        </span>
      </div>

      <div className="space-y-2">
        {models.map((m) => {
          const isRecommended = m.model === recommended;
          const isSelected = m.model === preference;
          return (
            <button
              key={m.id}
              onClick={() => handleSelect(m.id)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/20'
                  : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isSelected && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                  {isRecommended && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      default
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
        Your tier unlocks frontier models. Pro gets faster reasoning, Max gets the best. Defaults auto-select for your tier.
      </p>
    </div>
  );
}
