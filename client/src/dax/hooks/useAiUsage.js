import { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast, { resolveErrorMessage } from '../../utils/toast';

export function useAiUsage() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/dax/usage');
        setUsage(res.data);
      } catch (err) {
        setError(err);
        toast.error(resolveErrorMessage(err, 'Could not load your AI usage'), { id: 'ai-usage:load-failed' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { usage, loading, error };
}
