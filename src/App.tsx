import { useState, useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/sonner';
// import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import VIDEO from './assets/naturn9ne.mov'

const queryClient = new QueryClient();

// const VIDEO = '' PLACEHOLDER

type Phase = 'video' | 'done';

function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  });
  useEffect(() => {
    const handle = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return viewport;
}

const EASE_CINEMA: [number, number, number, number] = [0.16, 1, 0.3, 1];

function Home() {
  const [phase, setPhase] = useState<Phase>('video');
  const viewport = useViewport();

  // ── Brand position ────────────────────────────────────────────────────────
  // video  → top-left corner, small
  // done   → viewport centre, large
  const brandVideo = { top: 32, left: 32, x: '0%', y: '0%' } as const;
  const brandDone = { top: viewport.height / 2, left: viewport.width / 2, x: '-50%', y: '-50%' } as const;
  
  const brandTextVideo = { fontSize: '0.75rem', letterSpacing: '0.22em' } as const;
  const doneFontSize = Math.min(Math.max(viewport.width * 0.07, 32), 104)
  const brandTextDone = { fontSize:  doneFontSize, letterSpacing: '0.18em' } as const;

  // ── Tagline position ──────────────────────────────────────────────────────
  // video  → bottom-right corner (translate -100% so it anchors from bottom-right)
  // done   → below the brand name at centre
  const taglineVideo = { top: viewport.height - 48, left: viewport.width - 32, x: '-100%', y: '-100%' } as const;
  const taglineDone = { top: viewport.height / 2 + 100, left: viewport.width / 2, x: '-50%', y: '0%' } as const;

  const taglineTextVideo = { fontSize: '0.06rem', letterSpacing: '0.35em', color: 'rgba(255,255,255,0.4)' } as const;
  const taglineTextDone = {
    fontSize: viewport.width >= 640 ? '0.7rem' : '0.65rem',
    letterSpacing: '0.4em',
    color: 'rgba(255,255,255,0.55',
  } as const;
  


  const moveTransition = {
    duration: 1.8,
    ease: EASE_CINEMA,
    delay: phase === 'done' ? 0.25 : 0,
  };

  return (
    <main className="fixed inset-0 bg-black overflow-hidden select-none">

      {/* ── noise overlay (done phase only) ─────────────────────────────── */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div
            key="noise"
            className="pointer-events-none fixed inset-0 z-50 mix-blend-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.018 }}
            transition={{ duration: 4 }}
            style={{
              backgroundImage: `url("data:image:/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── ambient green glow (done phase only) ────────────────────────── */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div
            key="glow"
            className="pointer-events-none fixed inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 4, delay: 0.8 }}
          >
            <motion.div
              className="w-[80vw] h-[80vw] rounded-full mix-blend-screen"
              style={{ background: 'radial-gradient(circle, rgba(51,163,81,0.06) 0%, transparent 55%)' }}
              animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 14, ease: 'easeInOut', repeat: Infinity }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── placeholder video ────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'video' && (
          <motion.video
            key="video"
            className="absolute inset-0 w-full h-full object-cover z-0"
            src={VIDEO}
            autoPlay
            muted
            playsInline
            onEnded={() => setPhase('done')}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.6, ease: 'easeInOut' } }}
          />
        )}
      </AnimatePresence>

      {/* ── brand name ───────────────────────────────────────────────────── */}
      <motion.div
        className="fixed z-20 pointer-events-none"
        animate={phase === 'video' ? brandVideo : brandDone}
        transition={moveTransition}
      >
        <motion.h1
          className={'font-display uppercase whitespace-nowrap text-white/90'}
          animate={phase === 'video' ? brandTextVideo : brandTextDone }
          transition={moveTransition}
          style={{ lineHeight: 1 }}
        >
          <span className="text-white/90">Naturn</span>
          <motion.span
            className="text-[hsl(138_52%_42%)] font-medium"
            animate={
              phase === 'done'
                ? {
                    textShadow: [
                      '0 0 10px rgba(51,163,81,0)',
                      '0 0 40px rgba(51,163,81,0.55)',
                      '0 0 10px rgba(51,163,81,0)',
                    ],
                  }
                : { textShadow: '0 0 0px rgba(51,163,81,0)' }
            }
            transition={{ duration: 8, ease: 'easeInOut', repeat: Infinity }}
          >
            9
          </motion.span>
          <span className="text-white/90">ne</span>
        </motion.h1>
      </motion.div>

      {/* ── tagline ──────────────────────────────────────────────────────── */}
      <motion.div
        className="fixed z-20 pointer-events-none"
        animate={phase === 'video' ? taglineVideo : taglineDone}
        transition={{ ...moveTransition, delay: phase === 'done' ? 0.4 : 0 }}
      >
        <motion.p
          className={'font-sans font-light uppercase'}
          animate={phase === 'video' ? taglineTextVideo : taglineTextDone }
          transition={moveTransition}
          style={{ whiteSpace: 'nowrap' }}
        >
          Something significant is coming
        </motion.p>
      </motion.div>

      {/* ── instagram link (done phase only) ─────────────────────────────── */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div
            key="ig"
            className="fixed bottom-10 left-1/2 z-20"
            style={{ x: '-50%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 3, delay: 2.2 }}
          >
            <a
              href="https://instagram.com/naturn9ne"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.6rem] sm:text-[0.65rem] font-sans tracking-[0.22em] text-white/25 hover:text-white/80 transition-all duration-700 uppercase pointer-events-auto"
              style={{ letterSpacing: '0.22em' }}
            >
              @naturn9ne
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── skip hint (video phase only) ─────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'video' && (
          <motion.button
            key="skip"
            className="fixed bottom-8 right-8 z-30 pointer-events-auto font-sans text-[0.55rem] tracking-[0.3em] uppercase text-white/20 hover:text-white/60 transition-colors duration-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 2, duration: 1.5 }}
            onClick={() => setPhase('done')}
          >
            Skip
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
    </QueryClientProvider>
  );
}

export default App;