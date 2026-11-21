import { Link } from 'wouter';

const LINK = "text-[10px] tracking-widest uppercase text-foreground/70 hover:text-foreground transition-colors";

export default function Footer() {
  const year = new Date().getFullYear();
  const tagline = ["Ground here", "Tuned to elsewhere", `© ${year}`].join(" • ").toUpperCase();

  return (
    <footer className="w-full text-amber-50 bg-black py-12 md:py-24 mt-16 border-t border-white/5 ">
      <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row md:flex-wrap items-center justify-center gap-4 text-center">
        <h2 className="font-display font-bold tracking-widest uppercase text-[clamp(40px,11vw,180px)] leading-[0.85]">Naturn9ne</h2>
        <p className="text-muted-foreground text-[10px] tracking-widest max-w-md md:w-full md:whitespace-nowrap flex gap-1">{tagline}</p>
          <nav aria-label="Footer" className="mt-4 md:mt-0">
            <ul role="list" className="flex gap-6 items-baseline">
              <li><Link href="/shop" className={LINK}>Shop</Link></li>
              <li><Link href="/terms" className={LINK}>Terms</Link></li>
              <li>
                <a href="https://instagram.com/naturn9ne" target="_blank" rel="noopener noreferrer" className={LINK}>
                  Instagram<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            </ul>
        </nav>
      </div>
    </footer>
  )
}
