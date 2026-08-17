import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Crown, Sparkles, Zap, Shield, CreditCard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from '../utils/toast';
import { useAuth } from '../context/AuthContext';
import { activateTrial, getSubscriptionStatus } from '../api/subscription';
import BillingToggle from '../components/subscription/BillingToggle';
import PricingCard from '../components/subscription/PricingCard';
import CheckoutSummary from '../components/subscription/CheckoutSummary';
import FeatureTable from '../components/subscription/FeatureTable';
import FAQ from '../components/subscription/FAQ';
import CreditExplainer from '../components/subscription/CreditExplainer';
import { PLANS, FEATURE_ROWS, FAQ_ITEMS } from '../utils/pricing';
import useNow from '../hooks/useNow';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function SubscribePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [billing, setBilling] = useState('monthly');
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedPlan, setSubmittedPlan] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const now = useNow();

  useEffect(() => {
    getSubscriptionStatus()
      .then((res) => setDbStatus(res.data))
      .catch(() => {});
  }, []);

  const currentTier = dbStatus?.tier ?? user?.tier ?? 'free';
  const trialUsed = !!dbStatus?.trialUsed;
  const tierExpiresAt = dbStatus?.tierExpiresAt ? new Date(dbStatus.tierExpiresAt) : null;
  const daysLeft = tierExpiresAt
    ? Math.max(0, Math.ceil((tierExpiresAt - now) / (24 * 60 * 60 * 1000)))
    : null;

  const handleSelect = useCallback(async (plan) => {
    if (plan.id === 'trial') {
      setTrialLoading(true);
      try {
        const res = await activateTrial();
        toast.success('14-day trial activated! Redirecting…');
        setDbStatus((s) => ({
          ...s,
          tier: 'trial',
          trialUsed: true,
          tierExpiresAt: res.data?.expiresAt,
        }));
        setTimeout(() => navigate('/'), 2000);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Could not activate trial');
      } finally {
        setTrialLoading(false);
      }
      return;
    }
    if (plan.id === 'free') {
      navigate('/');
      return;
    }
    setCheckoutPlan(plan);
  }, [navigate]);

  const handleCheckoutSuccess = useCallback((plan) => {
    setCheckoutPlan(null);
    setSubmittedPlan(plan);
    setSubmitted(true);
  }, []);

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success-50 dark:bg-success-950/20">
          <CheckCircle2 className="h-8 w-8 text-success-500" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Payment Reference Submitted
        </h1>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          We&rsquo;ll verify your payment and activate{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-300">{submittedPlan?.label}</span> within
          24 hours. You&rsquo;ll be notified once it&rsquo;s done.
        </p>
        <Link
          to="/"
          className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3">
            {currentTier !== 'free' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                <Crown className="h-3 w-3" />
                {currentTier.toUpperCase()}
              </span>
            )}
            <a
              href="https://datad.in/support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Need help?
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-xs font-semibold text-primary-700 dark:border-primary-800/60 dark:bg-primary-900/30 dark:text-primary-300">
            <Sparkles className="h-3.5 w-3.5" />
            Premium AI for placement success
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Choose your edge
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-base text-gray-500 dark:text-gray-400">
            Unlock DATAD&rsquo;s full potential. From basic tools to premium AI — pick the plan that fits your ambition.
          </p>
        </motion.div>

        {/* Current plan banner */}
        {currentTier === 'trial' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-5 text-center dark:border-indigo-800 dark:bg-indigo-950/30"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
              <Sparkles className="h-3.5 w-3.5" /> Trial active
            </span>
            <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">
              Your 14-day trial is running
              {tierExpiresAt && (
                <> — expires <span className="font-bold">{fmtDate(tierExpiresAt)}</span>
                  {daysLeft !== null && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                      {daysLeft} day{daysLeft === 1 ? '' : 's'} left
                    </span>
                  )}
                </>
              )}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Upgrade to Pro or Max to keep the momentum going after your trial.
            </p>
          </motion.div>
        )}
        {(currentTier === 'pro' || currentTier === 'placement') && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-10 rounded-2xl border px-6 py-5 text-center ${
              currentTier === 'placement'
                ? 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/20'
                : 'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/15'
            }`}
          >
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white ${
                currentTier === 'placement' ? 'bg-purple-600' : 'bg-amber-500'
              }`}
            >
              {currentTier === 'placement' ? <Crown className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
              {currentTier === 'placement' ? 'PLACEMENT PASS' : 'PRO'} active
            </span>
            <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">
              {tierExpiresAt
                ? <>Valid till <span className="font-bold">{fmtDate(tierExpiresAt)}</span>
                    {daysLeft !== null && ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`}.
                  </>
                : 'Your plan is active.'}
            </p>
            {currentTier === 'pro' && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Placement season coming up? The Placement Pass adds ATS scoring, the
                interview simulator and company research for three months.
              </p>
            )}
          </motion.div>
        )}

        <div className="mb-10">
          <BillingToggle mode={billing} onChange={setBilling} />
        </div>

        <div className="mb-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <PricingCard
                plan={plan}
                billing={billing}
                onSelect={handleSelect}
                currentTier={currentTier}
                trialUsed={trialUsed}
                trialLoading={trialLoading}
              />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Everything included, compared
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              See exactly what each plan gives you.
            </p>
          </div>
          <FeatureTable
            features={FEATURE_ROWS}
            billing={billing}
            selectedPlan={checkoutPlan?.id || currentTier}
          />
        </motion.div>

        <div className="mb-14">
          <CreditExplainer />
        </div>

        <div className="mb-14">
          <FAQ items={FAQ_ITEMS} />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30">
              <Shield className="h-6 w-6 text-primary-500" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
              Secure & transparent
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Payments processed securely via UPI. Prices shown are the full amount payable. Your data is encrypted
              and never shared. Cancel anytime, no questions asked.
            </p>
            <div className="flex items-center gap-6 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> UPI / GPay / Paytm
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> 256-bit encryption
              </span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Prices shown are exclusive of applicable GST. +18% GST where applicable.
          <br />
          Plans are manually verified and activated within 24 hours.
        </p>
      </div>

      {checkoutPlan && (
        <CheckoutSummary
          plan={checkoutPlan}
          billing={billing}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}
