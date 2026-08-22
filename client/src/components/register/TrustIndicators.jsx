import { ShieldCheck, EyeOff, Building2 } from 'lucide-react';
import { IDENTITY } from './identityTokens';

// Trust row for the register hero.
//
// Every claim here is one the codebase actually backs: passwords are bcrypt
// hashed in authController.register, the product ships no analytics or ad SDK,
// and institution accounts genuinely pass through admin approval before they
// are activated. Nothing is a round number.
//
// Deliberately no "10,000+ students" counter. An unverifiable metric on a
// signup screen is the fastest way to lose the trust the section exists to
// build, and a student who can see their own campus isn't on the platform yet
// will read it as a lie. Swap in a real figure via `claims` once there is one
// worth quoting.
const DEFAULT_CLAIMS = [
  { icon: ShieldCheck, text: 'Passwords are hashed — never stored or readable, by anyone.' },
  { icon: EyeOff, text: 'No tracking. No ads. Your data belongs to you.' },
  { icon: Building2, text: 'Students and institutions onboard side by side, each reviewed.' },
];

export default function TrustIndicators({ claims = DEFAULT_CLAIMS, className = '', baseDelay = 0.75 }) {
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {claims.map(({ icon: Icon, text }, i) => (
        <li
          key={text}
          className="identity-slide flex items-start gap-2.5"
          style={{ '--rise-delay': `${baseDelay + i * 0.1}s` }}
        >
          <Icon className="mt-px h-3.5 w-3.5 shrink-0" style={{ color: IDENTITY.blue }} aria-hidden="true" />
          <span className="text-[12.5px] leading-snug" style={{ color: IDENTITY.muted }}>
            {text}
          </span>
        </li>
      ))}
    </ul>
  );
}
