import { PITCH_MODE } from '../../utils/workspaces';
import ComingSoonPage from '../../pages/ComingSoonPage';

// Wraps a route element so the college-fest pitch-mode build (VITE_PITCH_MODE=true)
// shows a Coming Soon placeholder instead of pages outside the 6-module demo
// scope, without deleting or moving any of the real page code.
export default function PitchGate({ title, children }) {
  if (PITCH_MODE) return <ComingSoonPage title={title} />;
  return children;
}
