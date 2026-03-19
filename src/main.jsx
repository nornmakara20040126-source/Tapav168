import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-sans-khmer/400.css'
import '@fontsource/noto-sans-khmer/500.css'
import '@fontsource/noto-sans-khmer/600.css'
import '@fontsource/noto-sans-khmer/700.css'
import './index.css'
import App from './App.jsx'

const INSTALL_PROMPT_DISMISSED_KEY = 'tapav-install-prompt-dismissed'

const getStandaloneState = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function AppShell() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(getStandaloneState)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === '1'
  })

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
        })
      } catch (error) {
        console.error('Service worker registration failed:', error)
      }
    }

    void registerServiceWorker()
    return undefined
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const syncStandaloneState = () => setIsStandalone(getStandaloneState())

    syncStandaloneState()
    mediaQuery.addEventListener?.('change', syncStandaloneState)
    window.addEventListener('appinstalled', syncStandaloneState)

    return () => {
      mediaQuery.removeEventListener?.('change', syncStandaloneState)
      window.removeEventListener('appinstalled', syncStandaloneState)
    }
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setDismissed(false)
      window.localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setDismissed(false)
      window.localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : ''
  const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream
  const isIosSafari = isIosDevice && /safari/.test(userAgent) && !/crios|fxios|edgios|opr\//.test(userAgent)

  const showIosPrompt = !isStandalone && !dismissed && isIosSafari
  const showInstallPrompt = !isStandalone && !dismissed && Boolean(deferredPrompt)

  const dismissPrompt = () => {
    setDismissed(true)
    window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, '1')
  }

  const installApp = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <>
      <App />

      {(showInstallPrompt || showIosPrompt) && (
        <div className="fixed inset-x-3 bottom-3 z-[90] sm:left-auto sm:right-4 sm:max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Install on Home Screen</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {showInstallPrompt
                    ? 'Add this app to your home screen for faster access and a full-screen experience.'
                    : 'On iPhone or iPad, open Share in Safari and choose Add to Home Screen.'}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissPrompt}
                className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                aria-label="Dismiss install prompt"
              >
                x
              </button>
            </div>

            {showInstallPrompt && (
              <button
                type="button"
                onClick={() => void installApp()}
                className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Install App
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)
