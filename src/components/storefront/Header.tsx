import { Link } from 'wouter';
import { ShoppingBag } from 'lucide-react'


export default function Header() {
  const cart = { totalQuantity: 2}; // hardcoded while I scaffold; TODO: replace
  const cartItemCount = cart?.totalQuantity || 0;
  
  return (
    <header className="top-0 z-50 sticky w-full bg-background/80 backdrop-blur-md border-b border-white/5">
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display font-bold text-xl tracking-wider uppercase text-foreground transition-opacity hover:opacity-80">NATURN9NE</Link>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-xs tracking-widest uppercase font-medium">
          <Link href="/shop" className="text-foreground/70 hover:text-foreground transition-colors">Shop All</Link>
          
          <div className="flex items-center gap-6">
            <Link href="/cart" className="relative flex items-center justify-center p-2 group">
                <ShoppingBag className="w-h h-5 text-foreground/80 group-hover:text-foreground transition-colors" strokeWidth={1.5} />
                {cartItemCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[9px] font-bold text-background bg-accent rounded-full">{cartItemCount}</span>
                )}
                </Link>
            </div>
          </nav>
        </div>
    </header>
  )
}

