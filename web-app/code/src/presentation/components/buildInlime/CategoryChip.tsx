/** The category pill worn by every article, in both the list and the section. */
export function CategoryChip({ category }: { category: string }) {
  return (
    <span
      className="inline-flex items-center bg-card-surface text-primary rounded-full px-[12px] py-[4px] font-['Instrument_Sans',sans-serif] text-[13px] leading-[18px]"
      style={{ fontVariationSettings: "'wdth' 100" }}
    >
      {category}
    </span>
  );
}

export default CategoryChip;
