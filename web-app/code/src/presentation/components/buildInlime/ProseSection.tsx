/**
 * A heading plus body copy, for the prose pages (/about).
 *
 * Narrower than the card sections on /features — long-form text wants a
 * measure it can be read at, not the full 1270px band.
 */

import type { AboutSection } from "../../content/about";

export function ProseSection({ section }: { section: AboutSection }) {
  return (
    <section className="w-full px-[120px] py-[20px]">
      <div className="max-w-[788px] mx-auto flex flex-col gap-[12px]">
        <h2 className="font-['Inria_Sans',sans-serif] font-bold text-[22px] leading-[31px] text-foreground">
          {section.title}
        </h2>

        {section.paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="font-['Instrument_Sans',sans-serif] text-[16px] leading-[26px] text-black"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

export default ProseSection;
