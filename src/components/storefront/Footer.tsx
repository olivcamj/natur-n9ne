import { Link } from 'wouter';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full text-amber-50 bg-black py-12 md:py-24 mt-16 border-t border-white/5 ">
      <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row md:flex-wrap items-center justify-center gap-6 text-center">
        <h2 className="font-display text-2xl font-bold tracking-widest uppercase order-1 md:order-2">Naturn9ne</h2>
          <nav className="flex gap-6 mt-4 md:mt-0 items-baseline order-3">
          <Link href="/shop" className="text-xs tracking-widest uppercase text-foreground/60 hover:text-foreground">Shop</Link>
          <Link href="/terms" className="text-xs tracking-widest uppercase text-foreground/60 hover:text-foreground">Terms</Link>
          <ul>
            <li className="transition-colors hover:text-neutral-900"><a href="https://instagram.com/naturn9ne" title="Follow us on Instagram" target="_blank" rel="noopener noreferrer">Instagram</a></li>
          </ul>
        </nav>
        <p className="text-xs whitespace-nowrap order-4 md:order-1">© {year} Naturn9ne</p>
        <p className="text-muted-foreground text-xs max-w-md order-2 md:order-4 md:w-full">Confidence in the dark. A premium editorial collection designed for those who take what they wear seriously</p>
      </div>
    </footer>
  )
}
