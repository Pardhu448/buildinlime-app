/**
 * One feature group — Structure, Tasks, Offline — on the /features page.
 *
 * Two columns of cards under a section heading. Each card wears the platform it
 * runs on, because web and mobile are not at parity and the page would mislead
 * without it.
 */

import { PLATFORM_LABELS } from "../../content/features";
import type { FeatureGroup } from "../../content/features";

function PlatformChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center shrink-0 bg-card-surface text-primary rounded-full px-[12px] py-[4px] font-['Instrument_Sans',sans-serif] text-[13px] leading-[18px]"
      style={{ fontVariationSettings: "'wdth' 100" }}
    >
      {label}
    </span>
  );
}

export function FeatureSection({ group }: { group: FeatureGroup }) {
  return (
    <section className="w-full px-6 lg:px-[120px] py-[28px]">
      <div className="max-w-[1270px] mx-auto flex flex-col gap-[20px]">
        {/* Section heading */}
        <div className="flex flex-col gap-[8px]">
          <h2 className="font-['Inria_Sans',sans-serif] font-bold text-[22px] leading-[31px] text-foreground">
            {group.title}
          </h2>
          <p
            className="font-['Instrument_Sans',sans-serif] text-[15px] leading-[22px] text-muted-foreground max-w-[788px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {group.description}
          </p>
        </div>

        {/* Two columns of cards need roughly 600px each to keep the name and the
            platform chip on one line; below lg: they stack. */}
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
          {group.features.map((feature) => (
            <li
              key={feature.name}
              className="bg-white border border-border rounded-[10px] p-[24px] flex flex-col gap-[10px]"
            >
              <div className="flex items-start justify-between gap-[12px]">
                <h3
                  className="font-['Instrument_Sans',sans-serif] font-semibold text-[16px] leading-[24px] text-black"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {feature.name}
                </h3>
                <PlatformChip label={PLATFORM_LABELS[feature.platform]} />
              </div>

              <p
                className="font-['Instrument_Sans',sans-serif] text-[15px] leading-[22px] text-black"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {feature.description}
              </p>

              {feature.note && (
                <p
                  className="font-['Instrument_Sans',sans-serif] text-[13px] leading-[18px] text-muted-foreground mt-auto pt-[4px]"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {feature.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default FeatureSection;
