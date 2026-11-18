import { Link } from 'wouter';

export default function Footer() {
  const year = new Date().getFullYear();
  const tagline = ["Ground here", "Tuned to elsewhere", `© ${year}`].join(" • ").toUpperCase();

  return (
    <footer className="w-full text-amber-50 bg-black py-12 md:py-24 mt-16 border-t border-white/5 ">
      <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row md:flex-wrap items-center justify-center gap-4 text-center">
        <h2 className="font-display font-bold tracking-widest uppercase text-[clamp(40px,11vw,180px)] leading-[0.85]">Naturn9ne</h2>
        <p className="text-muted-foreground text-[10px] tracking-widest max-w-md md:w-full md:whitespace-nowrap flex gap-1">{tagline}</p>
          <nav className="flex gap-6 mt-4 md:mt-0 items-baseline">
            <Link href="/shop" className="text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground">Shop</Link>
            <Link href="/terms" className="text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground">Terms</Link>
            <ul>
              <li><a href="https://instagram.com/naturn9ne" title="Follow us on Instagram" target="_blank" rel="noopener noreferrer" className="text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground transition-colors">Instagram</a></li>
            </ul>
        </nav>
      </div>
    </footer>
  )
}
