import { useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Monitor } from "lucide-react"
import { useIsBelowLg } from "#/hooks/use-viewport"

/**
 * Shown over the sign-in page when it is opened on a viewport narrower than
 * `lg:`.
 *
 * The in-app experience below that width is the desktop three-column shell —
 * sidebar, content, task rail — which has not been adapted for a phone. Rather
 * than let people discover that after signing in, this says so up front.
 *
 * It is ADVISORY, not a wall. "Continue anyway" is the primary action and simply
 * dismisses, revealing the sign-in form underneath; anyone who wants to sign in
 * on a phone always can.
 *
 * It deliberately links nowhere else: there is no published mobile app to send
 * people to yet (Android is built but unlisted, iOS is not shipping), and a
 * store button that 404s would be worse than no button.
 *
 * WHY IT LIVES ON THE PAGE rather than on the Login button: /login is reached
 * several ways that never touch that button — the hero's "Start Building" CTA
 * points at /projects and is bounced here by the _authenticated guard, a expired
 * session redirects here mid-visit, and people bookmark and type URLs. Hooking
 * the button covered the least-used of those paths. Gating on arrival covers all
 * of them and needs no interception logic.
 */

export interface DesktopRecommendedNoticeProps {
  /** Dismissed by the user; the page underneath takes over. */
  onDismiss: () => void
}

export function DesktopRecommendedNotice({ onDismiss }: DesktopRecommendedNoticeProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape closes, and focus moves into the dialog so the notice is announced
  // and keyboard users are not left behind the backdrop.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === `Escape`) onDismiss()
    }
    document.addEventListener(`keydown`, onKeyDown)
    dialogRef.current?.focus()

    // The backdrop covers the page, so the form behind it must not scroll under
    // the user's finger while the notice is up.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = `hidden`

    return () => {
      document.removeEventListener(`keydown`, onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onDismiss])

  const dismiss = onDismiss

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={dismiss} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-notice-title"
        aria-describedby="desktop-notice-body"
        tabIndex={-1}
        className="safe-pb relative bg-white w-full sm:max-w-[420px] rounded-t-[16px] sm:rounded-[16px] p-6 pb-8 sm:pb-6 shadow-xl outline-none"
      >
        <div className="flex flex-col items-center gap-[16px] text-center">
          <span
            className="flex items-center justify-center w-[48px] h-[48px] rounded-full bg-card-surface"
            aria-hidden="true"
          >
            <Monitor className="w-[24px] h-[24px] text-primary" strokeWidth={1.5} />
          </span>

          <h2
            id="desktop-notice-title"
            className="font-['Inria_Sans',sans-serif] font-bold text-[20px] leading-[28px] text-foreground"
          >
            BuildInLime works best on a desktop
          </h2>

          <p
            id="desktop-notice-body"
            className="font-['Instrument_Sans',sans-serif] text-[15px] leading-[22px] text-muted-foreground"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            The project workspace uses a wide, three-column layout that is not
            built for a phone screen yet. You can still sign in here, but you
            will have a much better time on a larger screen.
          </p>

          <div className="flex flex-col gap-[8px] w-full mt-[8px]">
            <button
              type="button"
              onClick={dismiss}
              className="w-full min-h-[44px] text-center bg-primary hover:bg-primary-hover text-white px-[24px] py-[14px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] leading-[24px] transition-colors"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Continue anyway
            </button>

            {/* The way out, for someone who would rather come back on a laptop.
                A real link, not a dismiss — there is nothing on this page for
                them if they are not signing in. */}
            <Link
              to="/"
              onClick={dismiss}
              className="w-full min-h-[44px] flex items-center justify-center text-center px-[24px] py-[12px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] leading-[24px] text-muted-foreground hover:text-foreground hover:bg-card-surface transition-colors"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Decides whether the notice is due, and renders it if so.
 *
 * Split from the dialog itself so the dialog has no opinion about when it
 * appears. Mounted by LoginPage.
 *
 * Dismissal is state on THIS component and is deliberately not persisted. It
 * lasts exactly as long as the mount, so dismissing reveals the form for the
 * current visit and a later return to /login asks again. An earlier version
 * remembered the dismissal in sessionStorage, which meant one "Continue anyway"
 * silenced it for the whole tab — including sign-in attempts hours later. Each
 * attempt is its own decision point, and the notice is one tap to clear, so the
 * cost of re-asking is far lower than the cost of never warning again.
 */
export function DesktopRecommendedNoticeGate() {
  const isBelowLg = useIsBelowLg()
  const [dismissed, setDismissed] = useState(false)

  if (!isBelowLg || dismissed) return null
  return <DesktopRecommendedNotice onDismiss={() => setDismissed(true)} />
}

export default DesktopRecommendedNotice
