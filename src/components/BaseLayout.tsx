import Header from '@/components/storefront/Header';
import Footer from '@/components/storefront/Footer';


export function BaseLayout({children}: {children: React.ReactNode}) {
  return (
    <div>
      <Header />
      <main className="flex-1 w-full flex flex-col">{children}</main>
      <Footer/>
    </div>
  )
}


