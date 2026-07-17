import { Link } from "@tanstack/react-router";
import imgBrickPattern from "../../assets/brick-logo-brown.png";

export function Footer() {
  return (
    <footer className="w-full px-[120px] py-[56px] border-t border-[#ac7f5e] mt-auto">
      <div className="max-w-[1268px] mx-auto flex items-start gap-[109px]">
        {/* Logo — links to the home page */}
        <Link to="/" className="shrink-0 hover:opacity-80 transition-opacity">
          <img
            src={imgBrickPattern}
            alt="BuildInLime"
            className="w-[54px] h-[34px] object-cover"
          />
        </Link>

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
              <a
                href="#blog"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Blog
              </a>
            </li>
            <li>
              <a
                href="#documentation"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Documentation
              </a>
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
              <a
                href="#features"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Features
              </a>
            </li>
            <li>
              <a
                href="#pricing"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Pricing
              </a>
            </li>
            <li>
              <a
                href="#support"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Support
              </a>
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
              <a
                href="#about"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                About
              </a>
            </li>
            <li>
              <a
                href="#careers"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Careers
              </a>
            </li>
            <li>
              <a
                href="#contact"
                className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-black hover:text-primary transition-colors"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
