import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../utils/toast';

// Validation utilities
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;

export const validateEmail = (email) => EMAIL_REGEX.test(email);

export const validatePassword = (password) => {
  const requirements = [
    { test: (p) => p.length >= PASSWORD_MIN_LENGTH, name: 'At least 8 characters' },
    { test: (p) => /[A-Z]/.test(p), name: 'One uppercase letter' },
    { test: (p) => /[a-z]/.test(p), name: 'One lowercase letter' },
    { test: (p) => /[0-9]/.test(p), name: 'One number' },
    { test: (p) => /[^A-Za-z0-9]/.test(p), name: 'One special character' },
  ];

  const passed = requirements.filter((r) => r.test(password));
  return { passed, total: requirements.length, score: passed.length / requirements.length };
};

export const useRegisterForm = (initialValues = {}) => {
  const form = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      // Onboarding data
      academicLevel: 'Undergraduate',
      fieldOfStudy: '',
      institution: '',
      graduationYear: '',
      careerInterests: [],
      skills: [],
      goals: [],
      learningPreferences: {
        style: '',
        timeAvailable: '',
      },
      ...initialValues,
    },
  });

  const { watch, setValue } = form;

  // Watch fields for dynamic behavior
  const password = watch('password', '');
  const careerInterests = watch('careerInterests', []);
  const skills = watch('skills', []);
  const goals = watch('goals', []);

  // Password strength calculation
  const passwordStrength = useMemo(() => validatePassword(password), [password]);

  // Check if form is valid for current step
  const isStepValid = (requiredFields = []) => {
    const values = form.getValues();
    return requiredFields.every((field) => {
      const value = values[field];
      if (Array.isArray(value)) return value.length > 0;
      return value && value.toString().trim() !== '';
    });
  };

  // Add/remove career interests
  const toggleCareerInterest = (interest) => {
    const current = careerInterests || [];
    const exists = current.includes(interest);
    const newValue = exists ? current.filter((i) => i !== interest) : [...current, interest];
    setValue('careerInterests', newValue, { shouldValidate: true });
  };

  // Add/remove skills
  const toggleSkill = (skill) => {
    const current = skills || [];
    const exists = current.includes(skill);
    const newValue = exists ? current.filter((s) => s !== skill) : [...current, skill];
    setValue('skills', newValue, { shouldValidate: true });
  };

  // Add/remove goals
  const toggleGoal = (goal) => {
    const current = goals || [];
    const exists = current.includes(goal);
    // Limit to 5 goals
    if (!exists && current.length >= 5) {
      toast.error('Maximum 5 goals allowed');
      return;
    }
    const newValue = exists ? current.filter((g) => g !== goal) : [...current, goal];
    setValue('goals', newValue, { shouldValidate: true });
  };

  // Set learning preference
  const setLearningStyle = (style) => {
    setValue('learningPreferences.style', style, { shouldValidate: true });
  };

  const setTimeAvailable = (time) => {
    setValue('learningPreferences.timeAvailable', time, { shouldValidate: true });
  };

  // Clear form
  const resetForm = () => {
    form.reset();
  };

  return {
    form,
    passwordStrength,
    careerInterests,
    skills,
    goals,
    isStepValid,
    toggleCareerInterest,
    toggleSkill,
    toggleGoal,
    setLearningStyle,
    setTimeAvailable,
    resetForm,
  };
};
