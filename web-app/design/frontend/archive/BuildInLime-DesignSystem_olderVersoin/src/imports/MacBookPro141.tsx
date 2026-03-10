import imgImage1 from "figma:asset/044683d680bab81b91974a32f614f0acede8855d.png";

function MarginLeft() {
  return <div className="absolute h-[982px] left-0 top-0 w-[120px]" data-name="marginLeft" />;
}

function BrickJhali() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid place-items-start relative shrink-0" data-name="brickJhali">
      <div className="col-1 h-[34px] ml-0 mt-0 relative row-1 w-[54px]" data-name="image1">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img alt="" className="absolute left-0 max-w-none size-full top-0" src={imgImage1} />
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[10px] items-start leading-[0] left-[-1px] top-[9px] w-[200px]" data-name="logo">
      <BrickJhali />
      <div className="absolute flex flex-col font-['Inria_Sans:Bold',sans-serif] inset-[-21.43%_5.66%_0_0] justify-end not-italic text-[#1e1e1e] text-[24px] text-right">
        <p className="leading-[1.5] whitespace-pre-wrap">BuildInLime</p>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="absolute bg-white border border-[#ac7f5e] border-solid h-[54px] left-[120px] overflow-clip top-0 w-[1272px]" data-name="header">
      <Logo />
    </div>
  );
}

function MarginRight() {
  return <div className="absolute h-[982px] left-[1394px] shadow-[0px_4px_4px_0px_#976623] top-0 w-[118px]" data-name="marginRight" />;
}

function BrickJhali1() {
  return (
    <div className="absolute contents inset-[-1px_calc(95.75%+0.92px)_calc(85.83%+0.72px)_-1px]" data-name="brickJhali">
      <div className="absolute inset-[0_95.75%_85.83%_0]" data-name="image1">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img alt="" className="absolute left-0 max-w-none size-full top-0" src={imgImage1} />
        </div>
      </div>
    </div>
  );
}

function PsmallSample() {
  return (
    <div className="absolute font-['Instrument_Sans:Regular',sans-serif] font-normal inset-[calc(14.17%-0.72px)_calc(83.18%+0.66px)_calc(16.25%-0.68px)_-1px] leading-[0] overflow-clip text-[14px] text-black text-right" data-name="psmallSample">
      <div className="-translate-x-full -translate-y-1/2 absolute flex flex-col h-[32px] justify-center left-[214px] top-[54px] w-[41px]" style={{ fontVariationSettings: "\'wdth\' 100" }}>
        <p className="leading-[1.5] whitespace-pre-wrap">Blog</p>
      </div>
      <div className="-translate-x-full -translate-y-1/2 absolute flex flex-col h-[32px] justify-center left-[214px] top-[86px] w-[102px]" style={{ fontVariationSettings: "\'wdth\' 100" }}>
        <p className="leading-[1.5] whitespace-pre-wrap">Documentation</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="absolute border border-[#ac7f5e] border-solid h-[240px] left-[120px] overflow-clip top-[742px] w-[1272px]" data-name="footer">
      <BrickJhali1 />
      <PsmallSample />
      <div className="absolute flex flex-col font-['Instrument_Sans:Regular',sans-serif] font-normal inset-[calc(14.17%-0.72px)_calc(83.18%+0.66px)_calc(72.5%+0.45px)_calc(7.08%-0.86px)] justify-center leading-[0] text-[16px] text-black text-right" style={{ fontVariationSettings: "\'wdth\' 100" }}>
        <p className="leading-[1.5] whitespace-pre-wrap">Resources</p>
      </div>
    </div>
  );
}

function ActionableCarousel() {
  return (
    <div className="absolute border border-[#ac7f5e] border-solid h-[677px] left-[120px] overflow-clip top-[55px] w-[811px]" data-name="ActionableCarousel">
      <div className="-translate-y-full absolute flex flex-col font-['Instrument_Sans:Regular',sans-serif] font-normal h-[48px] justify-end leading-[0] left-[11px] text-[32px] text-black top-[58px] w-[409px]" style={{ fontVariationSettings: "\'wdth\' 100" }}>
        <p className="leading-[1.5] whitespace-pre-wrap">Seamless Documentation</p>
      </div>
    </div>
  );
}

function FeaturesScroll() {
  return (
    <div className="absolute h-[688px] left-[931px] top-[54px] w-[461px]" data-name="FeaturesScroll">
      <div className="font-['Instrument_Sans:Regular',sans-serif] font-normal leading-[0] overflow-clip relative rounded-[inherit] size-full text-black">
        <div className="-translate-y-full absolute flex flex-col h-[84px] justify-end left-[10px] text-[20px] top-[126px] w-[313px]" style={{ fontVariationSettings: "\'wdth\' 100" }}>
          <p className="leading-[1.5] whitespace-pre-wrap">Easy collaboration among clients, architects and site-supervisors</p>
        </div>
        <div className="-translate-y-full absolute flex flex-col h-[42px] justify-end left-[10px] text-[24px] top-[42px] w-[239px]" style={{ fontVariationSettings: "\'wdth\' 100" }}>
          <p className="leading-[1.5] whitespace-pre-wrap">Features</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-2 border-[#976623] border-solid inset-[-2px] pointer-events-none" />
    </div>
  );
}

export default function MacBookPro() {
  return (
    <div className="bg-white relative size-full" data-name="MacBook Pro 14' - 1">
      <MarginLeft />
      <Header />
      <MarginRight />
      <Footer />
      <ActionableCarousel />
      <FeaturesScroll />
    </div>
  );
}