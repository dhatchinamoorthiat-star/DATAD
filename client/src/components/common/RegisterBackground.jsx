// Soft, calm backdrop for the register page — a faint dot grid plus a few
// blurred colour blobs in the same brand accents as the landing page, tying
// the signup flow visually back to where the student came from.
// Static (no motion): the form is the focus, the background just keeps the
// page from feeling bare.
export default function RegisterBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-white dark:bg-gray-950">
      <div
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(#9ca3af 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl" style={{ background: '#4D7CFF' }} />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: '#7C6CFF' }} />
      <div className="absolute right-1/4 top-1/3 h-56 w-56 rounded-full opacity-10 blur-3xl" style={{ background: '#0E9384' }} />
    </div>
  );
}
