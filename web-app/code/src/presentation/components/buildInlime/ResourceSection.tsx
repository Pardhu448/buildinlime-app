/**
 * One resource section — Blog or Documentation — on the /resources page.
 *
 * A single box stacked vertically: the latest article on top, the full history
 * beneath it. Both sections are structurally identical, so they share this
 * rather than the markup being written out twice.
 */

import { Link } from "@tanstack/react-router";
import { CategoryChip } from "./CategoryChip";
import type { Article } from "../../content/articles";

export type { Article };

export type ResourceSectionProps = {
  title: string;
  description: string;
  /** The full listing this section previews — /blog or /documentation. */
  to: "/blog" | "/documentation";
  /** Newest first — the head of the list is the featured article. */
  articles: Article[];
};

export function ResourceSection({ title, description, to, articles }: ResourceSectionProps) {
  const [latest, ...history] = articles;

  return (
    <section className="w-full px-6 lg:px-[120px] py-[56px]">
      <div className="max-w-[1270px] mx-auto flex flex-col gap-[32px]">
        {/* Section heading */}
        <div className="flex flex-col gap-[8px]">
          <h2 className="font-['Inria_Sans',sans-serif] font-bold text-[22px] leading-[31px] text-foreground">
            <Link to={to} className="hover:text-primary transition-colors">
              {title}
            </Link>
          </h2>
          <p
            className="font-['Instrument_Sans',sans-serif] text-[15px] leading-[22px] text-muted-foreground max-w-[788px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {description}
          </p>
        </div>

        {/* One box: latest article on top, history beneath */}
        <div className="bg-white border border-border rounded-[10px] overflow-hidden">
          {/* Latest */}
          <article className="p-[32px] flex flex-col gap-[16px] border-b border-border">
            <div className="flex items-center gap-[12px]">
              <span
                className="font-['Instrument_Sans',sans-serif] font-medium text-[13px] leading-[18px] text-primary uppercase tracking-[0.08em]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Latest
              </span>
              <CategoryChip category={latest.category} />
            </div>

            <h3
              className="font-['Instrument_Sans',sans-serif] font-semibold text-[20px] leading-[29px] text-black"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {latest.title}
            </h3>

            <p
              className="font-['Instrument_Sans',sans-serif] text-[13px] leading-[18px] text-muted-foreground"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              <time dateTime={latest.date}>{latest.displayDate}</time>
              {" · by "}
              {latest.author}
            </p>

            <p
              className="font-['Instrument_Sans',sans-serif] text-[15px] leading-[22px] text-black"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {latest.excerpt}
            </p>
          </article>

          {/* History */}
          <div className="p-[32px] flex flex-col gap-[16px]">
            <div className="flex items-baseline justify-between gap-[16px]">
              <h3
                className="font-['Instrument_Sans',sans-serif] font-semibold text-[18px] leading-[26px] text-black"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                All {title}
              </h3>
              <Link
                to={to}
                className="shrink-0 font-['Instrument_Sans',sans-serif] font-medium text-[13px] leading-[18px] text-primary hover:underline"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                View all →
              </Link>
            </div>

            {/* Caps at roughly four rows; the rest scrolls rather than growing
                the box without bound as the archive fills up. */}
            <ul className="flex flex-col max-h-[320px] overflow-y-auto pr-[8px]">
              {history.map((article) => (
                <li
                  key={article.title}
                  className="flex flex-col gap-[8px] py-[16px] border-b border-border last:border-b-0 last:pb-0"
                >
                  <h4
                    className="font-['Instrument_Sans',sans-serif] font-medium text-[15px] leading-[22px] text-black"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    {article.title}
                  </h4>
                  <div className="flex items-center gap-[12px]">
                    <span
                      className="font-['Instrument_Sans',sans-serif] text-[13px] leading-[18px] text-muted-foreground"
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      <time dateTime={article.date}>{article.displayDate}</time>
                      {" · by "}
                      {article.author}
                    </span>
                    <CategoryChip category={article.category} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ResourceSection;
