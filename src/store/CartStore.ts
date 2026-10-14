import { create } from 'zustand';

interface CartState {
  cartId: string | null;
  setCartId: (id: string | null) => void;
}

export const useCartStore = create<CartState>((set: any) => {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('cartId') : null;

  return {
    cartId: saved,
    setCartId: (id: string | null) => {
      if (id) {
        localStorage.setItem('cartId', id);
      } else {
        localStorage.removeItem('cartId');
      }
      set({ cartId: id });
    }
  }
})
