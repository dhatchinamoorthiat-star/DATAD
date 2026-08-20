import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Loader2, ArrowLeft, Copy, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { QRCodeSVG } from 'qrcode.react';
import { submitPaymentRef, getPaymentConfig, createOrder, verifyPayment } from '../../api/subscription';
import { useAuth } from '../../context/AuthContext';
import { loadRazorpayCheckout } from '../../utils/razorpay';
import { formatPrice, formatPriceDecimal, yearlySavings, monthlyEquivalent } from '../../utils/pricing';

const UPI_VPA  = import.meta.env.VITE_UPI_VPA  || 'datad@upi';
const UPI_NAME = import.meta.env.VITE_UPI_NAME || 'DATAD';

export default function CheckoutSummary({ plan, billing, onClose, onSuccess }) {
  const [step, setStep] = useState('summary');
  // The Placement Pass is a one-time purchase, so the monthly/yearly toggle
  // does not apply to it.
  const isOneTime = Boolean(plan.oneTime);
  const isYearly = !isOneTime && billing === 'yearly';
  const price = isOneTime ? plan.monthlyPrice : (billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice);
  // No GST: DATAD is not GST-registered, so the listed price is the total.
  const total = price;
  const savings = isYearly && plan.id === 'pro' ? yearlySavings(plan.id) : 0;
  const monthsFree = isYearly && plan.id === 'pro' ? Math.round((savings / plan.monthlyPrice) * 10) / 10 : 0;

  if (plan.id === 'trial' || plan.id === 'free') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900"
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
          isOneTime={isOneTime}
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
          isOneTime={isOneTime}
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

function PriceSummary({ plan, price, total, savings, monthsFree, isYearly, isOneTime, onClose, onContinue }) {
  const meq = isYearly ? monthlyEquivalent(price) : 0;
  const cycleLabel = isOneTime ? 'One-time' : isYearly ? 'Yearly' : 'Monthly';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Checkout</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{plan.label} — {cycleLabel}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800/50">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Plan</span>
              <span className="font-semibold text-gray-900 dark:text-white">{plan.label} {cycleLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Billing</span>
              <span className="font-semibold text-gray-900 dark:text-white">{isOneTime ? `${plan.durationMonths || 3} months, one payment` : isYearly ? 'Annual' : 'Monthly'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Price</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatPrice(price)}{isOneTime ? '' : isYearly ? '/year' : '/month'}
              </span>
            </div>
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
                {formatPriceDecimal(meq)}/month equivalent — that&rsquo;s almost {monthsFree} months free
              </p>
            </div>
          )}

          <div className="rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-950/20">
            <p className="text-center text-xs text-indigo-600 dark:text-indigo-400">
              This is the full amount payable — no additional taxes or fees.
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

function PaymentPanel({ plan, price, total, isYearly, isOneTime, onClose, onBack, onSuccess }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [paying, setPaying] = useState(false);
  // The manual UPI flow stays reachable even when the gateway is live: a
  // student whose bank drops out of Razorpay's UPI list still has to be able
  // to pay, and during KYC this is the only route that works at all.
  const [showManual, setShowManual] = useState(false);

  const billing = isOneTime ? 'onetime' : isYearly ? 'yearly' : 'monthly';
  const upiUrl = `upi://pay?pa=${UPI_VPA}&pn=${encodeURIComponent(UPI_NAME)}&am=${total}&tn=${encodeURIComponent(`DATAD ${plan.label}${isOneTime ? '' : isYearly ? ' Yearly' : ' Monthly'}`)}&cu=INR`;

  useEffect(() => {
    getPaymentConfig()
      .then((res) => setConfig(res.data))
      // A config that cannot be read is treated as no gateway, which lands the
      // student on the manual flow rather than on a dead end.
      .catch(() => setConfig({ gateway: 'manual' }));
  }, []);

  const gatewayReady = config?.gateway === 'razorpay';
  const manualOnly = config && !gatewayReady;

  const payWithRazorpay = async () => {
    setPaying(true);
    try {
      const Razorpay = await loadRazorpayCheckout();
      const { data: order } = await createOrder({ tier: plan.id, billing });

      const rzp = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'DATAD',
        description: `${plan.label} — ${isOneTime ? 'One-time' : isYearly ? 'Yearly' : 'Monthly'}`,
        prefill: { name: user?.name || '', email: user?.email || '' },
        theme: { color: '#4f46e5' },
        handler: async (response) => {
          try {
            // Confirming server-side is what actually grants the tier. The
            // webhook would get there on its own, but a student who just paid
            // should not have to wait on it.
            await verifyPayment(response);
            toast.success('Payment successful — your plan is active!');
            onSuccess(plan, { instant: true });
          } catch (err) {
            toast.error(
              err.response?.data?.message ||
                'Payment went through but confirmation failed. It will activate shortly.'
            );
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });

      rzp.on('payment.failed', (e) => {
        toast.error(e?.error?.description || 'Payment failed. Nothing was charged.');
        setPaying(false);
      });

      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Could not start payment.');
      setPaying(false);
    }
  };

  const onSubmit = async ({ paymentRef, upiId, note }) => {
    try {
      await submitPaymentRef({ tier: plan.id, paymentRef, upiId, note, billing, amount: total });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
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
          {!config && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {gatewayReady && (
            <div className="space-y-3">
              {config.testMode && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                  Test mode — no real money will move
                </p>
              )}
              <button
                onClick={payWithRazorpay}
                disabled={paying}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Pay {formatPriceDecimal(total)} securely
              </button>
              <p className="text-center text-xs text-gray-400">
                UPI · Cards · Netbanking · Wallets — activated instantly
              </p>
              {!showManual && (
                <button
                  onClick={() => setShowManual(true)}
                  className="w-full text-center text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Pay by direct UPI transfer instead
                </button>
              )}
            </div>
          )}

          {(manualOnly || showManual) && (
            <>
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
              <div className="flex justify-between border-t border-gray-200 py-1 font-semibold dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-gray-900 dark:text-white">{formatPriceDecimal(total)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label htmlFor="checkout-summary-payment-reference" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Payment Reference <span className="text-danger-500">*</span>
                </label>
                <input id="checkout-summary-payment-reference"
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
                <label htmlFor="checkout-summary-your-upi-id" className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Your UPI ID <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input id="checkout-summary-your-upi-id"
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
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
