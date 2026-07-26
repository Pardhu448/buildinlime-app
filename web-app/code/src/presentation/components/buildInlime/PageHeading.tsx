/**
 * The gradient band every marketing page opens with, under the header.
 *
 * Was copied verbatim across /resources and /get-started before /blog and
 * /documentation made it four.
 */
export function PageHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="w-full bg-gradient-to-b from-white to-muted px-6 lg:px-[120px] pt-[40px] pb-[28px]">
      <div className="max-w-[1270px] mx-auto flex flex-col items-center gap-[12px]">
        <h1 className="font-['Inria_Sans',sans-serif] font-bold text-[22px] leading-[32px] lg:text-[26px] lg:leading-[40px] text-foreground text-center max-w-[786px]">
          {title}
        </h1>
        <p
          className="font-['Instrument_Sans',sans-serif] text-[16px] leading-[24px] lg:text-[18px] lg:leading-[26px] text-muted-foreground text-center max-w-[788px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {description}
        </p>
      </div>
    </section>
  );
}

export default PageHeading;
