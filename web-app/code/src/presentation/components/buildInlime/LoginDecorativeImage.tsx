import imgJhali from "../../assets/3033b6238b041eebb3e905db71463ada5026ae2f.png";

export function LoginDecorativeImage() {
  // No top margin here: LoginPage's flex row already applies pt-[63px] to both
  // columns. Carrying mt-[63px] as well pushed the image 63px below the form it
  // is meant to sit level with.
  // Hidden below lg: rather than scaled down. It is decorative — it carries no
  // information the form needs — and at phone width it would push the actual
  // sign-in form a full screen height below the fold.
  return (
    <div className="hidden lg:block relative overflow-hidden w-[560px] ml-[110px] h-[657px]">
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
