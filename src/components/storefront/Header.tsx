import { Link } from 'wouter';
import { MobileNavLink } from '@/components/storefront/MobileNavLink';
import { ShoppingBag, Shirt, Home } from 'lucide-react'
import { useCart } from '@/hooks/useCart';

/** "Bag", "Bag, 1 item", "Bag, 3 items": what screen readers hear for the bag links. */
function bagLabel(count: number) {
  return count > 0 ? `Bag, ${count} ${count === 1 ? 'item' : 'items'}` : 'Bag';
}

export default function Header() {
  const { data: cart } = useCart();
  const cartItemCount = cart?.totalQuantity || 0;

  return (
    <>
    <header className="top-0 z-50 sticky w-full bg-background/80 backdrop-blur-md border-b border-white/5">
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="NATURN9NE home" className="font-display font-bold text-xl tracking-wider uppercase text-foreground transition-opacity hover:opacity-80">NATURN9NE</Link>
        </div>
        <nav aria-label="Main" className="hidden md:flex items-center gap-8 text-xs tracking-widest uppercase font-medium">
          <Link href="/shop" className="text-foreground/70 hover:text-foreground transition-colors">Shop All</Link>

          <div className="flex items-center gap-6">
            <Link href="/cart" aria-label={bagLabel(cartItemCount)} className="relative flex items-center justify-center p-2 group">
                <ShoppingBag aria-hidden className="w-5 h-5 text-foreground/80 group-hover:text-foreground transition-colors" strokeWidth={1.5} />
                {cartItemCount > 0 && (
                  <span aria-hidden className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[9px] font-bold text-signal-ink bg-signal rounded-full">{cartItemCount}</span>
                )}
                </Link>
            </div>
          </nav>
        </div>
      </header>
       <nav aria-label="Mobile" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-white/5 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 px-4">
          <MobileNavLink href="/" icon={Home} label="Home" />
          <MobileNavLink href="/shop" icon={Shirt} label="Shop" />
          <MobileNavLink href="/cart" icon={ShoppingBag} label="Bag" badge={cartItemCount} />
        </div>
      </nav>
    </>
  )
}
