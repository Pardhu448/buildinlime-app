import { useEffect, useRef } from "react"
import { Link } from "@tanstack/react-router"
import { Monitor } from "lucide-react"

/**
 * Shown when someone taps Login or Sign up on a viewport narrower than `lg:`.
 *
 * The in-app experience below that width is the desktop three-column shell —
 * sidebar, content, task rail — which has not been adapted for a phone. Rather
 * than let people discover that after signing in, this says so up front.
 *
 * It is ADVISORY, not a wall. "Continue anyway" is a real link to /login and is
 * the primary action; someone who wants to sign in on a phone always can. It
 * also deliberately links nowhere else: there is no published mobile app to send
 * people to yet (Android is built but unlisted, iOS is not shipping), and a
 * store button that 404s would be worse than no button.
 */

/** Session-scoped, so a new tab asks again but the current visit does not nag. */
const DISMISSED_KEY = `bil.desktop-notice.dismissed`

export function hasDismissedDesktopNotice(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === `1`
  } catch {
    // Safari in private mode throws on sessionStorage access rather than
    // returning null. Treat that as "not dismissed": showing the notice once
    // too often is a far smaller failure than the alternative, which is
    // suppressing it for everyone whose browser locks storage down.
    return false
  }
}

function rememberDismissal() {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, `1`)
  } catch {
    // Non-fatal — the notice simply shows again next time.
  }
}

export interface DesktopRecommendedNoticeProps {
  open: boolean
  onClose: () => void
  /** Where "Continue anyway" lands — login or signup. */
  mode: `login` | `signup`
  /** Carried through to /login so the post-auth redirect is unaffected. */
  returnTo: string
}

export function DesktopRecommendedNotice({
  open,
  onClose,
  mode,
  returnTo,
}: DesktopRecommendedNoticeProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape closes, and focus moves into the dialog so the notice is announced
  // and keyboard users are not left behind the backdrop.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === `Escape`) onClose()
    }
    document.addEventListener(`keydown`, onKeyDown)
    dialogRef.current?.focus()

    // The backdrop covers the page, so the content behind it must not scroll
    // under the user's finger while the notice is up.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = `hidden`

    return () => {
      document.removeEventListener(`keydown`, onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const dismiss = () => {
    rememberDismissal()
    onClose()
  }

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
            <Link
              to="/login"
              search={{ returnTo, mode }}
              onClick={dismiss}
              className="w-full text-center bg-primary hover:bg-primary-hover text-white px-[24px] py-[14px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] leading-[24px] transition-colors"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Continue anyway
            </Link>

            <button
              type="button"
              onClick={dismiss}
              className="w-full min-h-[44px] text-center px-[24px] py-[12px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] leading-[24px] text-muted-foreground hover:text-foreground hover:bg-card-surface transition-colors"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DesktopRecommendedNotice
