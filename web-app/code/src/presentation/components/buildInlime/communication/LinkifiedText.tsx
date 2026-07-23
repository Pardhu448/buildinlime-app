// Renders a string with any URLs turned into anchor tags — so a pasted map link
// (Google/Apple Maps, or a bare `geo:` link) or any other URL in a message is
// clickable. Message text was previously a plain <p>, so links were dead.
// Mirrors the mobile LinkifiedText.

// One capturing group, so String.split keeps the URLs as their own array slots.
// Matches http(s), a bare `www.` host, and `geo:` (lat,long) links.
const URL_SPLIT = /((?:https?:\/\/|geo:|www\.)[^\s]+)/gi
const URL_HEAD = /^(?:https?:\/\/|geo:|www\.)/i

function hrefFor(raw: string): string {
  // Trailing sentence punctuation is almost never part of the URL.
  const cleaned = raw.replace(/[.,;:!?)\]]+$/, "")
  return /^www\./i.test(cleaned) ? `https://${cleaned}` : cleaned
}

interface LinkifiedTextProps {
  text: string
  className?: string
}

export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const parts = text.split(URL_SPLIT)
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part && URL_HEAD.test(part) ? (
          <a
            key={i}
            href={hrefFor(part)}
            target="_blank"
            rel="noopener noreferrer"
            // Don't let a link tap bubble to any row-level handler (e.g. focus/scroll).
            onClick={(e) => e.stopPropagation()}
            className="text-primary underline break-all"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  )
}
