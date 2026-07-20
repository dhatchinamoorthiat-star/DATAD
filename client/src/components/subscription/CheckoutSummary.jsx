import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Loader2, ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { submitPaymentRef, activateTrial } from '../../api/subscription';
import { gstOf, totalWithGst, formatPrice, formatPriceDecimal, yearlySavings, monthlyEquivalent, dailyEquivalent } from '../../utils/pricing';

const UPI_VPA  = import.meta.env.VITE_UPI_VPA  || 'datad@upi';
const UPI_NAME = import.meta.env.VITE_UPI_NAME || 'DATAD';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renewalDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return fmtDate(d);
}

function yearlyRenewalDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return fmtDate(d);
}

export default function CheckoutSummary({ plan, billing, onClose, onSuccess }) {
  const [step, setStep] = useState('summary');
  const isYearly = billing === 'yearly';
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  const gst = gstOf(price);
  const total = totalWithGst(price);
  const savings = isYearly && plan.monthlyPrice > 0 ? yearlySavings(plan.id) : 0;
  const monthsFree = isYearly && plan.monthlyPrice > 0 ? Math.round((savings / plan.monthlyPrice) * 10) / 10 : 0;

  if (plan.id === 'trial' || plan.id === 'free') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm {plan.label}</h2>
            <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {plan.id === 'trial' ? 'Start your 14-day free trial. No card required. Cancel anytime.' : 'Free plan — no payment needed.'}
          </p>
          <div className="mt-6 flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button onClick={() => onSuccess(plan)} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              {plan.id === 'trial' ? 'Start Free Trial' : 'Get Started'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleContinue = () => setStep('payment');

  return (
    <AnimatePresence>
      {step === 'summary' && (
        <PriceSummary
          plan={plan}
          price={price}
          gst={gst}
          total={total}
          savings={savings}
          monthsFree={monthsFree}
          isYearly={isYearly}
          onClose={onClose}
          onContinue={handleContinue}
        />
      )}
      {step === 'payment' && (
        <PaymentPanel
          plan={plan}
          price={price}
          gst={gst}
          total={total}
          isYearly={isYearly}
          onClose={onClose}
          onBack={() => setStep('summary')}
          onSuccess={onSuccess}
        />
      )}
    </AnimatePresence>
  );
}

function PriceSummary({ plan, price, gst, total, savings, monthsFree, isYearly, onClose, onContinue }) {
  const meq = isYearly ? monthlyEquivalent(price) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Checkout</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{plan.label} — {isYearly ? 'Yearly' : 'Monthly'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800/50">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Plan</span>
              <span className="font-semibold text-gray-900 dark:text-white">{plan.label} {isYearly ? 'Yearly' : 'Monthly'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Billing</span>
              <span className="font-semibold text-gray-900 dark:text-white">{isYearly ? 'Annual' : 'Monthly'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Price</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatPrice(price)}{isYearly ? '/year' : '/month'}
              </span>
            </div>
            {gst > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">GST (18%)</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatPriceDecimal(gst)}</span>
              </div>
            )}
            {savings > 0 && (
              <div className="flex justify-between text-success-600 dark:text-success-400">
                <span>Yearly savings</span>
                <span className="font-semibold">−{formatPriceDecimal(savings)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
              <div className="flex justify-between text-base">
                <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatPriceDecimal(total)}</span>
              </div>
            </div>
          </div>

          {isYearly && (
            <div className="rounded-xl bg-success-50 px-4 py-3 text-center dark:bg-success-950/15">
              <p className="text-sm font-semibold text-success-700 dark:text-success-400">
                Save {formatPriceDecimal(savings)} with yearly billing
              </p>
              <p className="text-xs text-success-600 dark:text-success-300">
                {formatPriceDecimal(meq)}/month equivalent — that's almost {monthsFree} months free
              </p>
            </div>
          )}

          <div className="rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-950/20">
            <p className="text-center text-xs text-indigo-600 dark:text-indigo-400">
              Prices shown are exclusive of applicable GST.
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button onClick={onContinue} className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-primary-600 dark:hover:bg-primary-700">
              Continue to Payment
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PaymentPanel({ plan, price, gst, total, isYearly, onClose, onBack, onSuccess }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const upiUrl = `upi://pay?pa=${UPI_VPA}&pn=${encodeURIComponent(UPI_NAME)}&am=${total}&tn=${encodeURIComponent(`DATAD ${plan.label} ${isYearly ? 'Yearly' : 'Monthly'}`)}&cu=INR`;

  const onSubmit = async ({ paymentRef, upiId, note }) => {
    try {
      await submitPaymentRef({ tier: plan.id, paymentRef, upiId, note, billing: isYearly ? 'yearly' : 'monthly', amount: total });
      toast.success('Payment reference submitted! We will activate your plan within 24 hours.');
      onSuccess(plan);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed. Please try again.');
    }
  };

  const copyUPI = () => {
    navigator.clipboard.writeText(UPI_VPA);
    toast.success('UPI ID copied');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button onClick={onBack} aria-label="Back" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Pay</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{plan.label} — {formatPriceDecimal(total)}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Scan with any UPI app</p>
            <div className="rounded-xl border-2 border-gray-200 bg-white p-3 dark:border-gray-700">
              <QRCodeSVG value={upiUrl} size={180} />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm dark:bg-gray-800">
              <span className="font-mono text-gray-700 dark:text-gray-300">{UPI_VPA}</span>
              <button onClick={copyUPI} className="text-gray-400 hover:text-gray-600">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-400">PhonePe · GPay · Paytm · BHIM</p>
          </div>

          <div className="rounded-xl bg-gray-50 p-3 text-xs dark:bg-gray-800/50">
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatPrice(price)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">GST (18%)</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatPriceDecimal(gst)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 py-1 font-semibold dark:border-gray-700">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-gray-900 dark:text-white">{formatPriceDecimal(total)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment Reference <span className="text-danger-500">*</span>
              </label>
              <input
                {...register('paymentRef', {
                  required: 'Reference number is required',
                  minLength: { value: 6, message: 'Enter the full reference number' },
                })}
                placeholder="e.g. 421234567890"
                className="w-full rounded-xl border border-gray-200 bg-transparent px-3.5 py-2 text-sm placeholder:text-gray-400 focus:border-primary-400 focus:outline-none dark:border-gray-700"
              />
              {errors.paymentRef && (
                <p className="mt-1 text-xs text-danger-500">{errors.paymentRef.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
                Your UPI ID <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                {...register('upiId')}
                placeholder="yourname@upi"
                className="w-full rounded-xl border border-gray-200 bg-transparent px-3.5 py-2 text-sm placeholder:text-gray-400 focus:border-primary-400 focus:outline-none dark:border-gray-700"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-primary-600 dark:hover:bg-primary-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Submit Payment Reference
            </button>
          </form>

          <p className="text-center text-xs text-gray-400">
            Your plan will be activated within 24 hours after verification.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
