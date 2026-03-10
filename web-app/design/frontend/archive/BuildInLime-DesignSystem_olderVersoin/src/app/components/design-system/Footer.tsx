import { BrickPattern } from "./BrickPattern";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

interface FooterProps {
  sections?: FooterSection[];
  className?: string;
}

export function Footer({ sections, className = "" }: FooterProps) {
  const defaultSections: FooterSection[] = [
    {
      title: "Resources",
      links: [
        { label: "Blog", href: "#" },
        { label: "Documentation", href: "#" },
      ],
    },
  ];

  const displaySections = sections || defaultSections;

  return (
    <footer className={`border-t border-[#ac7f5e] bg-white ${className}`}>
      <div className="max-w-screen-2xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <BrickPattern className="h-[34px] w-[54px]" />
          </div>
          
          {displaySections.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-4">
              <h3 className="font-['Instrument_Sans',sans-serif] font-medium text-base text-black">
                {section.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {section.links.map((link, linkIdx) => (
                  <li key={linkIdx}>
                    <a 
                      href={link.href}
                      className="font-['Instrument_Sans',sans-serif] text-sm text-black hover:text-[#976623] transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
