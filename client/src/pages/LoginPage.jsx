import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from '../utils/toast';
import Button from '../components/common/Button';
import AuthShell from '../components/layout/AuthShell';
import BinaryRainBackground from '../components/common/BinaryRainBackground';
import { login as loginApi, resendVerification } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { signalWelcome } from '../utils/welcome';

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2.5 font-mono text-sm text-emerald-300 placeholder:text-gray-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

export default function LoginPage() {
  const { register, handleSubmit, formState } = useForm();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep link from the landing page or a guarded route: land there after login.
  const rawNext = searchParams.get('next') || '/dashboard';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  // Set when the API says this account still needs confirming. Login is a hard
  // gate on that, and the link expires, so the user needs a way to ask for a
  // new one right here — a toast that disappears is not a recovery path.
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const onResend = async () => {
    if (!unverifiedEmail || resending) return;
    setResending(true);
    try {
      const res = await resendVerification(unverifiedEmail);
      setResent(true);
      toast.success(res.data?.message || 'Check your inbox for a new confirmation link.');
    } catch (err) {
      if (err.response?.status === 429) {
        toast.error('Too many attempts. Wait a few minutes before trying again.');
      } else if (!err.response) {
        toast.error('Network error — check your connection and try again.');
      } else {
        toast.error(err.response.data?.message || 'Could not resend right now. Try again shortly.');
      }
    } finally {
      setResending(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      const res = await loginApi(data);
      const account = login(res.data.token);
      // Raised before the navigate so the curtain is already up when the
      // destination starts mounting — it holds until that page has loaded.
      signalWelcome({ name: account?.name?.split(' ')[0] || '', target: next });
      navigate(next, { replace: true });
    } catch (err) {
      if (err.response?.data?.needsEmailVerification) {
        setUnverifiedEmail(data.email);
        setResent(false);
        toast.info(err.response.data.message, { icon: '📧', duration: 6000 });
        return;
      }
      setUnverifiedEmail(null);
      if (err.response?.data?.pending) {
        toast.info(err.response.data.message, { icon: '⏳', duration: 6000 });
        return;
      }
      toast.error(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <AuthShell
      background={<BinaryRainBackground />}
      cardClassName="rounded-2xl border border-emerald-500/20 bg-gray-950/90 p-6 shadow-[0_0_40px_-12px_rgba(16,185,129,0.3)] backdrop-blur-sm"
      subtitleClassName="mt-2 font-mono text-sm text-emerald-400/80"
      footerClassName="mt-5 text-center font-mono text-[11px] text-gray-500"
      subtitle={
        <span className="inline-flex items-center">
          &gt; authenticate --user
          <span className="blink-cursor ml-0.5 inline-block h-3.5 w-[7px] bg-emerald-400 align-middle" />
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block font-mono text-xs text-emerald-400/80">
            $ email
          </label>
          <input id="email" type="email" {...register('email', { required: true })} className={inputClass} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="block font-mono text-xs text-emerald-400/80">
              $ password
            </label>
            <Link to="/forgot-password" className="font-mono text-xs text-emerald-400/70 hover:text-emerald-300 hover:underline">
              forgot?
            </Link>
          </div>
          <input id="password" type="password" {...register('password', { required: true })} className={inputClass} />
        </div>
        <Button
          type="submit"
          fullWidth
          disabled={formState.isSubmitting}
          loading={formState.isSubmitting}
          className="!bg-emerald-600 !font-mono hover:!bg-emerald-500"
        >
          {formState.isSubmitting ? 'authenticating…' : 'run login()'}
        </Button>
        {unverifiedEmail && (
          <div
            role="status"
            className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center"
          >
            <p className="font-mono text-xs text-amber-300/90">
              {resent
                ? '> confirmation link sent — check inbox and spam'
                : '> this account is not confirmed yet'}
            </p>
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="mt-2 font-mono text-xs font-medium text-emerald-400 underline underline-offset-2 hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-gray-600 disabled:no-underline"
            >
              {resending ? 'sending…' : resent ? 'send another link' : 'resend confirmation email'}
            </button>
          </div>
        )}
        <p className="text-center font-mono text-sm text-gray-500">
          new here?{' '}
          <Link to="/register" className="font-medium text-emerald-400 hover:underline">
            create_account()
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
