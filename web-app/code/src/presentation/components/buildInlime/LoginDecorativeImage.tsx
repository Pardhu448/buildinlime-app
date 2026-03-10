import imgJhali from "../../assets/3033b6238b041eebb3e905db71463ada5026ae2f.png";

export function LoginDecorativeImage() {
  return (
    <div className="relative overflow-hidden w-[560px] ml-[110px] mt-[63px] h-[657px]">
      <img
        src={imgJhali}
        alt="Brick staircase architecture"
        className="w-full h-full object-cover rounded-lg"
      />
      <p
        className="absolute bottom-[37px] left-[20px] font-['Instrument_Sans',sans-serif] text-[12px] leading-[16px] text-white z-10"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        © borrowed from : Symphony in Bricks - Remembering Laurie Bakers Legacy by Sushila Murmu
      </p>
    </div>
  );
}
