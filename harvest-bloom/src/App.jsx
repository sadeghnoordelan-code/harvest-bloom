import { useCallback } from 'react'
import Header from './components/Header.jsx'
import HeroScrollVideo from './components/HeroScrollVideo.jsx'
import Story from './components/Story.jsx'
import ProductLoop from './components/ProductLoop.jsx'
import OrderSummary from './components/OrderSummary.jsx'
import Contact from './components/Contact.jsx'
import Footer from './components/Footer.jsx'
import { CartProvider } from './store/CartContext.jsx'

export default function App() {
  const skipHero = useCallback(() => {
    document.querySelector('#collection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <CartProvider>
      <a className="skip" href="#collection">
        Skip to the collection
      </a>
      <Header />
      <main>
        <HeroScrollVideo onSkip={skipHero} />
        <Story />
        <ProductLoop />
        <OrderSummary />
        <Contact />
      </main>
      <Footer />
    </CartProvider>
  )
}
