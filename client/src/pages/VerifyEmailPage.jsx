import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { verifyEmail } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function VerifyEmailPage() {
  useDocumentTitle('Confirm your email');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [state, setState] = useState({ status: 'verifying' });
  // StrictMode double-invokes effects in dev, and the token is single-use —
  // the second call would always fail and overwrite a successful result.
  const claimed = useRef(false);

  // Runs once on mount to redeem the link (or report that it is malformed).
  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: 'error', message: 'This link is missing its confirmation token.' });
      return;
    }
    if (claimed.current) return;
    claimed.current = true;

    verifyEmail(token)
      .then((res) => {
        // A referred or auto-approved account comes back with a session and
        // goes straight in; everyone else waits for an admin.
        if (res.data.token) {
          login(res.data.token);
          setState({ status: 'success' });
          setTimeout(() => navigate('/dashboard'), 1200);
        } else {
          setState({ status: 'pending', message: res.data.message });
        }
      })
      .catch((err) =>
        setState({
          status: 'error',
          message: err.response?.data?.message || 'Could not confirm this link.',
        })
      );
  }, [params, navigate, login]);

  const view = {
    verifying: {
      icon: <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />,
      title: 'Confirming your email…',
      body: 'One moment.',
    },
    success: {
      icon: <CheckCircle2 className="h-12 w-12 text-emerald-500" />,
      title: 'Email confirmed',
      body: 'Taking you to your dashboard…',
    },
    pending: {
      icon: <Clock className="h-12 w-12 text-amber-500" />,
      title: 'Email confirmed',
      body: state.message || 'An admin will review your account shortly.',
    },
    error: {
      icon: <XCircle className="h-12 w-12 text-rose-500" />,
      title: "That link didn't work",
      body: state.message,
    },
  }[state.status];

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-5 flex justify-center">{view.icon}</div>
        <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">{view.title}</h1>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{view.body}</p>

        {(state.status === 'error' || state.status === 'pending') && (
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            Go to login
          </Link>
        )}
      </div>
    </div>
  );
}
