// Register experience — the split-screen "identity" onboarding.
export { default as IdentityShell } from './IdentityShell';
export { default as HeroVisual } from './HeroVisual';
export { default as NeuralField } from './NeuralField';
export { default as PhaseRail } from './PhaseRail';
export { default as RegisterForm } from './RegisterForm';
export { default as FloatingField } from './FloatingField';
export { default as PasswordStrength, scorePassword, meetsPolicy } from './PasswordStrength';
export { default as RoleSelector, ACCOUNT_TYPES } from './RoleSelector';
export { default as TrustIndicators } from './TrustIndicators';
export { default as AIPreviewCard } from './AIPreviewCard';
export { IDENTITY } from './identityTokens';

// Profiling screens, unchanged — the redesign reframes them, it doesn't
// rewrite what they collect.
export { default as AcademicStep } from './AcademicStep';
export { default as GoalsStep } from './GoalsStep';
export { default as LearningStyleStep } from './LearningStyleStep';
export { default as ChallengesStep } from './ChallengesStep';
export { default as ExperienceStep } from './ExperienceStep';
export { default as SummaryStep } from './SummaryStep';
