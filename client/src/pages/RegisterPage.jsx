import { useState } from 'react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, MailCheck, Loader2, AlertTriangle } from 'lucide-react';
import toast from '../utils/toast';
import { register as registerApi, checkEmail } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { isAvailableAccountType } from '../components/register/RoleSelector';
import {
  IdentityShell,
  RegisterForm,
  AcademicStep,
  GoalsStep,
  LearningStyleStep,
  ChallengesStep,
  ExperienceStep,
  SummaryStep,
} from '../components/register';

// The four phases the student is shown. They are a framing device over the
// screens below, not a 1:1 map — see PhaseRail for why the grouping matters.
//
// Phase 04 is deliberately unreachable during signup: the dashboard is on the
// far side of email confirmation, and the rail says so rather than implying
// the form is the last thing between them and the product.
const PHASES = [
  { number: '01', label: 'Account' },
  { number: '02', label: 'Profile' },
  { number: '03', label: 'Intelligence Setup' },
  { number: '04', label: 'Personalised Dashboard' },
];

// Screens, tagged with the phase each belongs to.
//
// WelcomeStep is gone: it was a screen of feature tiles standing between the
// student and the first input, and the hero panel now tells that story beside
// the form instead of before it. ProgramStep is replaced by RegisterForm.
// Every other step, and the payload they build, is unchanged.
const STEPS = [
  { component: RegisterForm,      phase: 0 },
  { component: AcademicStep,      phase: 1 },
  { component: ExperienceStep,    phase: 1 },
  { component: GoalsStep,         phase: 2 },
  { component: LearningStyleStep, phase: 2 },
  { component: ChallengesStep,    phase: 2 },
  { component: SummaryStep,       phase: 2 },
];

const ACCOUNT_STEP = 0;

const DEFAULT_VALUES = {
  name: '', email: '', password: '', confirmPassword: '',
  accountType: 'student',
  rollNumber: '', referralCode: '',
  course: '', specialization: '', college: '', department: '',
  batch: '', semester: '', graduationYear: '',
  careerInterests: [],
  skills: [],
  goals: [],
  learningStyle: '',
  timeAvailable: '',
  challenges: [],
  studentType: 'fresher',
  workExYears: '',
  priorDomain: '',
};

// Fraction completed within the active phase, so the rail's connector fills
// smoothly across a four-screen phase instead of only at phase boundaries.
function phaseProgressAt(step) {
  const { phase } = STEPS[step];
  const inPhase = STEPS.filter((s) => s.phase === phase);
  const position = STEPS.slice(0, step).filter((s) => s.phase === phase).length;
  return inPhase.length > 1 ? position / inPhase.length : 0;
}

export default function RegisterPage() {
  const methods = useForm({ defaultValues: DEFAULT_VALUES, mode: 'onChange' });
  const { handleSubmit, trigger, getValues, setError, formState: { isSubmitting } } = methods;
  const { login } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [done, setDone] = useState(null);

  // Faculty and institutions don't have a course, a semester or a placement
  // cohort, so the six student profiling screens don't apply to them. They
  // submit straight from the account step and land in the approval queue,
  // which is where a claim to represent a campus should be reviewed anyway.
  // useWatch, not methods.watch: the latter makes React Compiler bail out of
  // memoising this whole component, and this page re-renders on every keystroke.
  const accountType = useWatch({ control: methods.control, name: 'accountType' }) || 'student';
  const isStudent = accountType === 'student';
  const lastStep = isStudent ? STEPS.length - 1 : ACCOUNT_STEP;
  const isFinalStep = step === lastStep;

  const go = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
    // Each screen is a new page as far as the reader is concerned, and the
    // form column can be scrolled down on a short viewport.
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  const back = () => go(Math.max(step - 1, 0));

  // Validate the account fields and make sure the address is free before
  // letting anyone invest time in the profiling screens — discovering the
  // collision only at final submit means retyping everything.
  const validateAccountStep = async () => {
    const fieldsOk = await trigger(['name', 'email', 'password', 'confirmPassword']);
    if (!fieldsOk) return false;

    setCheckingEmail(true);
    try {
      const res = await checkEmail(getValues('email'));
      if (res.data.exists) {
        setError('email', {
          type: 'manual',
          message: 'This email already has a DATAD identity — log in instead.',
        });
        return false;
      }
      return true;
    } catch {
      toast.error("Couldn't verify your email just now — try again.");
      return false;
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleNext = async () => {
    if (step === ACCOUNT_STEP && !(await validateAccountStep())) return;
    go(Math.min(step + 1, lastStep));
  };

  const onSubmit = async (data) => {
    // A non-student submits directly from the account step, so this is the
    // only place their email uniqueness gets checked.
    if (step === ACCOUNT_STEP && !(await validateAccountStep())) return;

    try {
      const isExp = data.studentType === 'experienced';
      const payload = {
        name: data.name,
        email: data.email,
        password: data.password,
        // Honeypot — always empty for real users; the server rejects it if filled.
        website: data.website || '',
        // NOTE: `accountType`, not `role`. The server owns `role` (admin|member)
        // and sets it from the admin-email check.
        //
        // Coerced to an account type that actually exists. The server has no
        // reference to `accountType` anywhere, so whatever is sent is discarded
        // — which meant someone could select "Faculty", be told they would
        // "mentor students and track cohort progress", and silently receive a
        // plain student account. RoleSelector now disables the unbuilt types, but
        // that is presentation: this line is what makes the sent value and the
        // created account agree even if the form is manipulated or a default
        // leaks through from a saved draft.
        accountType: isAvailableAccountType(data.accountType) ? data.accountType : 'student',
        rollNumber: data.rollNumber || '',
        referralCode: data.referralCode || '',
        studentType: data.studentType || 'fresher',
        course: data.course || '',
        specialization: data.specialization || '',
        college: data.college || '',
        department: data.department || '',
        batch: data.batch || '',
        semester: data.semester || '',
        graduationYear: data.graduationYear || undefined,
        careerInterests: data.careerInterests || [],
        skills: data.skills || [],
        goals: data.goals || {},
        learningStyle: data.learningStyle || '',
        timeAvailable: data.timeAvailable || '',
        challenges: data.challenges || [],
        experience: isExp
          ? { years: Number(data.workExYears) || 0, type: 'experienced', pastDomain: data.priorDomain || '' }
          : { years: 0, type: 'fresher', pastDomain: '' },
      };

      const res = await registerApi(payload);

      // Registration never returns a session — the server issues no token until
      // the address is confirmed. The old `login(res.data.token)` branch here
      // could not fire, so the success state is the confirmation screen, and
      // the token path stays only as a guard in case that policy is relaxed.
      if (res.data.token) {
        login(res.data.token);
        toast.success('Welcome to DATAD!');
        navigate('/dashboard');
        return;
      }

      setDone({
        message: res.data.message || '',
        emailSent: res.data.emailSent !== false,
        email: data.email,
      });
    } catch (err) {
      const message = err.response?.data?.message || "Couldn't create your profile just now.";
      toast.error(message);
      // A 409 is about the email specifically — send the student back to the
      // field they can actually fix rather than leaving them on the review
      // screen with a toast that has already faded.
      if (err.response?.status === 409) {
        setError('email', { type: 'manual', message });
        go(ACCOUNT_STEP);
      }
    }
  };

  if (done) {
    return (
      <IdentityShell phases={PHASES} activePhase={3} phaseProgress={0}>
        <IdentityCreated {...done} />
      </IdentityShell>
    );
  }

  const StepComponent = STEPS[step].component;
  const busy = isSubmitting || checkingEmail;
  const cta = ctaLabel({ busy, checkingEmail, isSubmitting, isFinalStep, step });

  return (
    <IdentityShell
      phases={PHASES}
      activePhase={STEPS[step].phase}
      phaseProgress={phaseProgressAt(step)}
    >
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* mode="wait" so the outgoing screen is gone before the next one
              arrives — two absolutely-positioned forms overlapping mid-flight
              would let a keystroke land in the screen that is leaving. */}
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={reduce ? false : { opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <StepComponent />
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-3 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/20 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>
            )}

            <button
              type={isFinalStep ? 'submit' : 'button'}
              onClick={isFinalStep ? undefined : handleNext}
              disabled={busy}
              // Explicit name rather than relying on name-from-content: the
              // first child is an aria-hidden sheen span, and this is the one
              // control on the page that must never announce as "button".
              aria-label={cta}
              className="group relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary-600 px-5 py-3 text-[13.5px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-400 dark:disabled:opacity-50"
            >
              {/* Sheen on hover. Pure transform, so it composites rather than
                  repainting the button on every frame. */}
              {!reduce && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
              )}
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{cta}</span>
              {!busy && !isFinalStep && (
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>

          {step === ACCOUNT_STEP && isStudent && (
            <p className="mt-2 text-center text-[11.5px] text-gray-400 dark:text-gray-600">
              Takes about 2 minutes. You can refine everything later.
            </p>
          )}
        </form>
      </FormProvider>
    </IdentityShell>
  );
}

// The submit button never says "Register" or "Sign Up". It says what the click
// actually does at that moment — which is why the headline CTA appears on the
// screen that genuinely creates the profile, not on step one where it would be
// a promise the button doesn't keep.
function ctaLabel({ busy, checkingEmail, isSubmitting, isFinalStep, step }) {
  if (checkingEmail) return 'Checking your email…';
  if (isSubmitting) return 'Building your profile…';
  if (busy) return 'Working…';
  if (isFinalStep) return 'Create My Intelligence Profile';
  if (step === ACCOUNT_STEP) return 'Begin my intelligence profile';
  return 'Continue';
}

function IdentityCreated({ message, emailSent, email }) {
  return (
    // CSS entrance again: this screen is the only confirmation that an account
    // was created, so it renders whether or not an animation frame runs.
    <div className="identity-rise text-center">
      <div
        className={`identity-rise mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
          emailSent
            ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300'
            : 'bg-warn-50 text-warn-700 dark:bg-warn-500/15 dark:text-warn-500'
        }`}
        style={{ '--rise-delay': '0.08s' }}
      >
        {emailSent
          ? <MailCheck className="h-7 w-7" aria-hidden="true" />
          : <AlertTriangle className="h-7 w-7" aria-hidden="true" />}
      </div>

      <h2 className="identity-rise mt-5 text-[24px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white" style={{ '--rise-delay': '0.16s' }}>
        {emailSent ? 'One step left' : 'Profile created'}
      </h2>

      <p className="identity-rise mx-auto mt-2 max-w-[22rem] text-[13.5px] leading-relaxed text-gray-500 dark:text-gray-400" style={{ '--rise-delay': '0.22s' }}>
        {emailSent ? (
          <>
            Your intelligence profile is built. Confirm{' '}
            <span className="font-medium text-gray-700 dark:text-gray-200">{email}</span>{' '}
            to unlock your dashboard.
          </>
        ) : (
          message || "Your profile is saved, but the confirmation email didn't go out. Use \u201cresend confirmation email\u201d on the login page in a moment."
        )}
      </p>

      <Link
        to="/login"
        className="identity-rise mt-6 inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30 dark:bg-primary-500 dark:hover:bg-primary-400"
        style={{ '--rise-delay': '0.3s' }}
      >
        {emailSent ? 'Go to login' : 'Resend from login'}
      </Link>
    </div>
  );
}
