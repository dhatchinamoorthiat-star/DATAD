import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

// A flashcard, not a paragraph: the whole tile is a Link into the real
// in-app workspace for that pillar. Signed-out visitors bounce through
// /login (ProtectedRoute's `next` param) and land exactly where they
// clicked once they're in.
export default function FeatureCard({ feature }) {
  const Icon = feature.icon;
  return (
    <Link
      to={feature.route}
      className={`group relative flex flex-col justify-between bg-gradient-to-b ${feature.glow} border ${feature.ring} rounded-3xl p-6 sm:p-7 min-h-[220px] shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl`}
    >
      <div>
        <div className={`p-3 rounded-2xl bg-slate-950/80 border border-slate-800 w-fit shadow-md ${feature.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-white mt-4">{feature.name}</h3>
        <p className={`text-[11px] font-mono uppercase tracking-wider mt-1 ${feature.color}`}>{feature.tagline}</p>
        <p className="text-xs text-slate-400 leading-relaxed mt-3">{feature.hook}</p>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/80">
        <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
          Open workspace
        </span>
        <ArrowUpRight className={`w-4 h-4 ${feature.color} transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5`} />
      </div>
    </Link>
  );
}
