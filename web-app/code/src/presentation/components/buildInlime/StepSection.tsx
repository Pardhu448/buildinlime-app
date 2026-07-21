/**
 * One numbered section — Signup or Sample Project — on the /get-started page.
 *
 * Structurally the sibling of ResourceSection: same section chrome (heading,
 * description, 1270px container), but the body is an ordered list of steps
 * rather than articles. `children` renders between the description and the
 * steps, which is where the sample project puts its brief and BuildUnit map.
 */

import type { ReactNode } from "react";

export type Step = {
  title: string;
  detail: string;
  /** Optional sub-points, rendered under the detail as a bulleted list. */
  points?: string[];
};

export type StepSectionProps = {
  /** Anchor target, so the nav and footer can deep-link to a section. */
  id: string;
  title: string;
  description: string;
  steps: Step[];
  children?: ReactNode;
};

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center w-[32px] h-[32px] rounded-full bg-card-surface text-primary font-['Instrument_Sans',sans-serif] font-semibold text-[13px] leading-[18px]"
      style={{ fontVariationSettings: "'wdth' 100" }}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}

export function StepSection({ id, title, description, steps, children }: StepSectionProps) {
  return (
    <section id={id} className="w-full px-[120px] py-[56px]">
      <div className="max-w-[1270px] mx-auto flex flex-col gap-[32px]">
        {/* Section heading */}
        <div className="flex flex-col gap-[8px]">
          <h2 className="font-['Inria_Sans',sans-serif] font-bold text-[22px] leading-[31px] text-foreground">
            {title}
          </h2>
          <p
            className="font-['Instrument_Sans',sans-serif] text-[15px] leading-[22px] text-muted-foreground max-w-[788px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {description}
          </p>
        </div>

        {children}

        {/* Steps */}
        <ol className="bg-white border border-border rounded-[10px] p-[32px] flex flex-col">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="flex items-start gap-[16px] py-[20px] border-b border-border first:pt-0 last:border-b-0 last:pb-0"
            >
              <StepNumber n={i + 1} />
              <div className="flex flex-col gap-[8px]">
                <h3
                  className="font-['Instrument_Sans',sans-serif] font-semibold text-[18px] leading-[26px] text-black"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {step.title}
                </h3>
                <p
                  className="font-['Instrument_Sans',sans-serif] text-[15px] leading-[22px] text-black"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {step.detail}
                </p>
                {step.points && (
                  <ul className="flex flex-col gap-[4px] pl-[20px] list-disc marker:text-primary">
                    {step.points.map((point) => (
                      <li
                        key={point}
                        className="font-['Instrument_Sans',sans-serif] text-[13px] leading-[18px] text-muted-foreground"
                        style={{ fontVariationSettings: "'wdth' 100" }}
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default StepSection;
