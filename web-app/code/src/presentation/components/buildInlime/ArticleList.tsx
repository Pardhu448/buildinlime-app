/**
 * The full, unabridged list of articles — what /blog and /documentation show.
 *
 * ResourceSection's history list is the abridged cousin of this: it drops the
 * newest entry into a featured card and caps its height. Here every article is
 * printed in full, on the page itself rather than inside a box, so the page
 * scrolls as an article does.
 */

import { CategoryChip } from "./CategoryChip";
import type { Article } from "../../content/articles";

export type ArticleListProps = {
  articles: Article[];
};

export function ArticleList({ articles }: ArticleListProps) {
  return (
    <div className="w-full px-[120px] pb-[40px]">
      <div className="max-w-[788px] mx-auto flex flex-col">
        {articles.map((article) => (
          <article
            key={article.title}
            className="flex flex-col gap-[12px] py-[40px] border-b border-border first:pt-0 last:border-b-0"
          >
            <h2
              className="font-['Instrument_Sans',sans-serif] font-semibold text-[22px] leading-[31px] text-black"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {article.title}
            </h2>

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

            <p
              className="font-['Instrument_Sans',sans-serif] font-medium text-[17px] leading-[26px] text-black"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {article.excerpt}
            </p>

            <div className="flex flex-col gap-[16px]">
              {article.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 48)}
                  className="font-['Instrument_Sans',sans-serif] text-[15px] leading-[24px] text-black"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default ArticleList;
