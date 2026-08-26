import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Terminal, Sparkles } from 'lucide-react';
import toast from '../utils/toast';
import Button from '../components/common/Button';
import AuthShell from '../components/layout/AuthShell';
import { login as loginApi, resendVerification, acceptConsent } from '../api/auth';
import ReconsentGate from '../components/auth/ReconsentGate';
import { CONSENT_CLAUSE_IDS, LEGAL_VERSIONS } from '../constants/legal';
import { useAuth } from '../context/AuthContext';
import { signalWelcome } from '../utils/welcome';
import { SKINS, readSkin, writeSkin } from './loginSkins';

export default function LoginPage() {
  const { register, handleSubmit, formState } = useForm();
  // Which dressing the screen wears. Read once on mount rather than on every
  // render so a toggle is a state change, not a storage round-trip.
  const [skinId, setSkinId] = useState(readSkin);
  const skin = SKINS[skinId];
  const copy = skin.copy;

  const toggleSkin = () => {
    const nextSkin = skinId === 'terminal' ? 'standard' : 'terminal';
    setSkinId(nextSkin);
    writeSkin(nextSkin);
  };

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

  // Set when the API holds the sign-in back for consent. The ticket is the only
  // thing kept from that response — it is not a session, and nothing about the
  // account is readable until the acceptance is recorded.
  const [consentHold, setConsentHold] = useState(null);
  const [acceptingConsent, setAcceptingConsent] = useState(false);

  // The session that login withheld, issued once the acceptance is on record.
  // Deliberately the same landing as an ordinary sign-in: having just accepted
  // the terms is not a reason to drop someone somewhere unexpected.
  const finishLogin = (token) => {
    const account = login(token);
    signalWelcome({ name: account?.name?.split(' ')[0] || '', target: next });
    navigate(next, { replace: true });
  };

  const onAcceptConsent = async (ticked) => {
    if (acceptingConsent) return;
    setAcceptingConsent(true);
    try {
      const res = await acceptConsent({
        consentToken: consentHold.consentToken,
        consent: {
          accepted: CONSENT_CLAUSE_IDS.reduce((acc, id) => ({ ...acc, [id]: ticked[id] === true }), {}),
          versions: { ...LEGAL_VERSIONS },
        },
      });
      finishLogin(res.data.token);
    } catch (err) {
      // A 401 here means the ticket expired or the account changed underneath
      // it. Send them back to the password field rather than leaving a dead
      // Accept button on screen.
      if (err.response?.status === 401) {
        setConsentHold(null);
        toast.error(err.response.data?.message || 'That took too long — please sign in again.');
      } else {
        toast.error(err.response?.data?.message || 'Could not record your acceptance. Try again.');
      }
    } finally {
      setAcceptingConsent(false);
    }
  };

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
      // Raised before the navigate so the curtain is already up when the
      // destination starts mounting — it holds until that page has loaded.
      finishLogin(res.data.token);
    } catch (err) {
      if (err.response?.data?.needsConsent) {
        setUnverifiedEmail(null);
        setConsentHold({
          consentToken: err.response.data.consentToken,
          email: data.email,
          // Whether they have accepted some earlier revision, which decides
          // whether this reads as "these changed" or "your account predates
          // these". The server distinguishes the two in its message.
          returning: /changed/i.test(err.response.data.message || ''),
        });
        return;
      }
      if (err.response?.data?.needsEmailVerification) {
        setUnverifiedEmail(data.email);
        setResent(false);
        toast.info(err.response.data.message, { duration: 6000 });
        return;
      }
      setUnverifiedEmail(null);
      if (err.response?.data?.pending) {
        toast.info(err.response.data.message, { duration: 6000 });
        return;
      }
      toast.error(err.response?.data?.message || 'Login failed');
    }
  };

  const subtitle = consentHold ? copy.consentSubtitle : skin.subtitle;

  return (
    <>
      {/* Skin switch. Deliberately quiet and in the corner: the terminal look is
          an easter egg for people who like it, not a decision the screen asks
          every visitor to make. */}
      <button
        type="button"
        onClick={toggleSkin}
        aria-pressed={skinId === 'terminal'}
        title={skinId === 'terminal' ? 'Switch to the standard theme' : 'Switch to the 01 terminal theme'}
        className={`fixed right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          skinId === 'terminal'
            ? 'border-emerald-500/30 font-mono text-emerald-400/80 hover:border-emerald-500/60 hover:text-emerald-300'
            : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-100'
        }`}
      >
        {skinId === 'terminal' ? (
          <><Sparkles className="h-3.5 w-3.5" /> Standard</>
        ) : (
          <><Terminal className="h-3.5 w-3.5" /> 01 theme</>
        )}
      </button>

    <AuthShell
      background={skin.background}
      {...skin.shell}
      subtitle={
        skinId === 'terminal' ? (
          <span className="inline-flex items-center">
            &gt; {subtitle}
            <span className="blink-cursor ml-0.5 inline-block h-3.5 w-[7px] bg-emerald-400 align-middle" />
          </span>
        ) : (
          subtitle
        )
      }
    >
      {/* The password form is replaced, not merely hidden behind the gate: the
          credentials have already been checked, and leaving a live login form
          on screen would invite retyping them into an unexpected interstitial. */}
      {consentHold ? (
        <ReconsentGate
          email={consentHold.email}
          returning={consentHold.returning}
          submitting={acceptingConsent}
          onAccept={onAcceptConsent}
          tone={skin.consent}
        />
      ) : (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className={skin.label}>
            {copy.email}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email', { required: true })}
            className={skin.input}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className={skin.label}>
              {copy.password}
            </label>
            <Link to="/forgot-password" className={skin.link}>
              {copy.forgot}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password', { required: true })}
            className={skin.input}
          />
        </div>
        <Button
          type="submit"
          fullWidth
          disabled={formState.isSubmitting}
          loading={formState.isSubmitting}
          className={skin.submitClass}
        >
          {formState.isSubmitting ? copy.submitting : copy.submit}
        </Button>
        {unverifiedEmail && (
          <div role="status" className={skin.notice}>
            <p className={skin.noticeText}>{resent ? copy.linkSent : copy.unconfirmed}</p>
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className={skin.noticeAction}
            >
              {resending ? copy.resending : resent ? copy.resendAgain : copy.resend}
            </button>
          </div>
        )}
        <p className={skin.footerText}>
          {copy.newHere}{' '}
          <Link to="/register" className={skin.footerLink}>
            {copy.create}
          </Link>
        </p>
      </form>
      )}
    </AuthShell>
    </>
  );
}
