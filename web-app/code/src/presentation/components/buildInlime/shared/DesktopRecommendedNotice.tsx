import { useEffect, useRef, useState } from "react"
import { Monitor } from "lucide-react"
import { useIsBelowLg } from "#/hooks/use-viewport"

/**
 * Shown over the authenticated app when it is entered on a viewport narrower
 * than `lg:`.
 *
 * The in-app experience below that width is the desktop three-column shell —
 * sidebar, content, task rail — which has not been adapted for a phone. This
 * says so on arrival, so the layout is explained rather than merely encountered.
 *
 * It is ADVISORY, not a wall. "Got it" dismisses and the workspace underneath
 * takes over; anyone who wants to use the app on a phone always can.
 *
 * It deliberately links nowhere else: there is no published mobile app to send
 * people to yet (Android is built but unlisted, iOS is not shipping), and a
 * store button that 404s would be worse than no button.
 *
 * WHY IT FIRES AFTER SIGN-IN rather than on /login: the warning is about the
 * WORKSPACE, so it belongs at the point the workspace appears. On /login it
 * interrupted people before they had committed to anything and stood between
 * them and the form — including on every expired-session bounce. Sign-in itself
 * is perfectly usable on a phone; it is what comes after that is not.
 *
 * It also carries a single action now. On /login the dialog needed a way out
 * ("Back to home") because there was nothing else on that page for someone who
 * was not signing in. Past the sign-in boundary that link is a dead end into the
 * marketing site, so the notice is one button and the app is already behind it.
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
            built for a phone screen yet. Everything works, but you will have a
            much better time on a larger screen.
          </p>

          <div className="flex flex-col gap-[8px] w-full mt-[8px]">
            <button
              type="button"
              onClick={dismiss}
              className="w-full min-h-[44px] text-center bg-primary hover:bg-primary-hover text-white px-[24px] py-[14px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] leading-[24px] transition-colors"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Got it
            </button>
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
 * appears. Mounted by AuthenticatedLayout, OUTSIDE the keyed <Outlet>.
 *
 * That mount point is what makes this once per login. Dismissal is state on THIS
 * component and is deliberately not persisted, so it lasts exactly as long as
 * the mount — and the authenticated layout stays mounted for the whole signed-in
 * visit. Dismissing therefore silences the notice while the user moves around
 * the workspace, and a later sign-in or reload raises it again. Note the layout
 * re-keys the Outlet on resync (`dataVersion`) and NOT this gate, so a
 * membership resync mid-session does not re-prompt.
 *
 * Persisting to storage was tried on the old /login placement and removed
 * (7fbca98): it silenced the notice for the entire tab. Mount-scoped state gets
 * the same "don't nag" behaviour without outliving the session.
 */
export function DesktopRecommendedNoticeGate() {
  const isBelowLg = useIsBelowLg()
  const [dismissed, setDismissed] = useState(false)

  if (!isBelowLg || dismissed) return null
  return <DesktopRecommendedNotice onDismiss={() => setDismissed(true)} />
}

export default DesktopRecommendedNotice
