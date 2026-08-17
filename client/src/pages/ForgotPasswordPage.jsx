import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import toast from '../utils/toast';
import { MailCheck } from 'lucide-react';
import Button from '../components/common/Button';
import AuthShell from '../components/layout/AuthShell';
import { forgotPassword } from '../api/auth';

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState } = useForm();
  const [sent, setSent] = useState(false);

  const onSubmit = async ({ email }) => {
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      toast.error('Something went wrong — please try again');
    }
  };

  if (sent) {
    return (
      <AuthShell subtitle="Check your inbox">
        <div className="space-y-3 py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
            <MailCheck className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold">Reset link sent</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            If an account exists for that email, you&rsquo;ll receive a password reset link. It&rsquo;s valid
            for 30 minutes — check spam if it doesn&rsquo;t arrive.
          </p>
          <Link
            to="/login"
            className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="We'll email you a reset link">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="email" type="email" {...register('email', { required: true })} className="input" />
        </div>
        <Button type="submit" fullWidth disabled={formState.isSubmitting} loading={formState.isSubmitting}>Send reset link</Button>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
