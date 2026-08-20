import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function DaxShell({
  sidebarOpen,
  sidebarProps,
  headerRight,
  banner,
  children,
  composer,
  showAIPanel,
  aiPanel,
  onToggleSidebar,
}) {
  return (
    <div className="dax-root flex h-screen w-full overflow-hidden font-sans">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 264, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden shrink-0"
          >
            <Sidebar {...sidebarProps} collapsed={false} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 px-4">
          <button
            data-sidebar-toggle
            onClick={() => onToggleSidebar(!sidebarOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--dax-text-muted)] hover:text-[var(--dax-text)] hover:bg-[var(--dax-surface-hover)] transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          {headerRight}
        </header>

        {banner && <div className="shrink-0 px-4 pb-2">{banner}</div>}

        <div className="flex min-h-0 flex-1 gap-0">
          <main className="min-w-0 flex-1 overflow-y-auto dax-scrollbar">
            {children}
          </main>

          <AnimatePresence>
            {showAIPanel && aiPanel && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 256, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden shrink-0 border-l border-[var(--dax-border)]"
              >
                <div className="w-64 p-4 overflow-y-auto dax-scrollbar h-full">
                  {aiPanel}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {composer && (
          <div className="shrink-0 pb-3 pt-1"
            style={{
              background: 'linear-gradient(to top, var(--dax-bg) 0%, var(--dax-bg) 70%, transparent 100%)',
            }}
          >
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
              {composer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
