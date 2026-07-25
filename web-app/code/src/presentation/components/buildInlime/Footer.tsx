import { Link } from "@tanstack/react-router";
import imgBrickPattern from "../../assets/brick-logo-brown.png";

/**
 * `compact` drops the three link columns, leaving just the copyright — used on
 * the reading pages (/resources, /blog, /documentation), where a full sitemap
 * under the content is more furniture than the page needs.
 */
export function Footer({ compact = false }: { compact?: boolean } = {}) {
  if (compact) {
    return <CompactFooter />;
  }

  return (
    <footer className="w-full px-[120px] py-[56px] border-t border-border mt-auto">
      <div className="max-w-[1268px] mx-auto flex items-start gap-[60px]">
        {/* Logo — links to the home page, with the copyright sitting under it */}
        <div className="flex flex-col gap-[16px] shrink-0 w-[220px]">
          <Link to="/" className="hover:opacity-80 transition-opacity w-fit">
            <img
              src={imgBrickPattern}
              alt="BuildInLime"
              className="w-[54px] h-[34px] object-cover"
            />
          </Link>
          <Copyright />
        </div>

        {/* Resources */}
        <div className="flex flex-col gap-[16px] w-[284.15px]">
          <h3
            className="font-['Instrument_Sans',sans-serif] font-medium text-[16px] leading-[24px] text-black"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Resources
          </h3>
          <ul className="flex flex-col gap-[8px]">
            <li>
              <Link
                to="/blog"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Blog
              </Link>
            </li>
            <li>
              <Link
                to="/documentation"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Documentation
              </Link>
            </li>
          </ul>
        </div>

        {/* Product */}
        <div className="flex flex-col gap-[16px] w-[284.15px]">
          <h3
            className="font-['Instrument_Sans',sans-serif] font-medium text-[16px] leading-[24px] text-black"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Product
          </h3>
          <ul className="flex flex-col gap-[8px]">
            <li>
              <Link
                to="/features"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Features
              </Link>
            </li>
            <li>
              <Link
                to="/pricing"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Pricing
              </Link>
            </li>
            <li>
              <Link
                to="/support"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Support
              </Link>
            </li>
          </ul>
        </div>

        {/* Company */}
        <div className="flex flex-col gap-[16px] w-[284.15px]">
          <h3
            className="font-['Instrument_Sans',sans-serif] font-medium text-[16px] leading-[24px] text-black"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Company
          </h3>
          <ul className="flex flex-col gap-[8px]">
            <li>
              <Link
                to="/about"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                About
              </Link>
            </li>
            <li>
              <Link
                to="/contact"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Contact
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div className="flex flex-col gap-[16px] w-[284.15px]">
          <h3
            className="font-['Instrument_Sans',sans-serif] font-medium text-[16px] leading-[24px] text-black"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Legal
          </h3>
          <ul className="flex flex-col gap-[8px]">
            <li>
              <Link
                to="/privacy"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function CompactFooter() {
  return (
    <footer className="w-full px-[120px] py-[22px] border-t border-border mt-auto">
      <div className="max-w-[1268px] mx-auto flex items-center justify-center">
        <Copyright />
      </div>
    </footer>
  );
}

function Copyright() {
  return (
    <p
      className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-muted-foreground"
      style={{ fontVariationSettings: "'wdth' 100" }}
    >
      {"© "}
      {new Date().getFullYear()}
      {" "}
      <a
        href="https://barefootprogrammers.in"
        className="hover:text-primary transition-colors"
        target="_blank"
        rel="noreferrer"
      >
        barefootprogrammers.in
      </a>
      {". All rights reserved."}
    </p>
  );
}

export default Footer;
