import imgBrick from "figma:asset/044683d680bab81b91974a32f614f0acede8855d.png";

export function BrickPatternDisplay() {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imgBrick;
    link.download = 'brick-pattern.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-['Inria_Sans',sans-serif] font-bold text-3xl text-[#1e1e1e]">
            Brick Pattern Asset
          </h1>
          
          <button
            onClick={handleDownload}
            className="px-6 py-3 bg-[#976623] text-white rounded-lg hover:bg-[#7d5419] transition-colors font-['Instrument_Sans',sans-serif] font-medium"
          >
            Download Image
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Original size */}
          <div>
            <h2 className="font-['Instrument_Sans',sans-serif] font-medium text-lg text-[#976623] mb-2">
              Original Size
            </h2>
            <div className="border-2 border-[#ac7f5e] rounded-lg p-4 inline-block bg-white">
              <img 
                src={imgBrick} 
                alt="Brick pattern" 
                className="block"
              />
            </div>
          </div>

          {/* Scaled up */}
          <div>
            <h2 className="font-['Instrument_Sans',sans-serif] font-medium text-lg text-[#976623] mb-2">
              Scaled (400px width)
            </h2>
            <div className="border-2 border-[#ac7f5e] rounded-lg p-4 inline-block bg-white">
              <img 
                src={imgBrick} 
                alt="Brick pattern scaled" 
                className="block w-[400px] h-auto"
              />
            </div>
          </div>

          {/* As repeating pattern */}
          <div>
            <h2 className="font-['Instrument_Sans',sans-serif] font-medium text-lg text-[#976623] mb-2">
              As Repeating Pattern
            </h2>
            <div 
              className="border-2 border-[#ac7f5e] rounded-lg h-[400px]"
              style={{
                backgroundImage: `url(${imgBrick})`,
                backgroundSize: '100px auto',
                backgroundRepeat: 'repeat'
              }}
            />
          </div>
        </div>

        {/* Asset info */}
        <div className="mt-8 p-4 bg-[#fdf8f2] border border-[#ac7f5e] rounded-lg">
          <p className="font-['Instrument_Sans',sans-serif] text-sm text-[#1e1e1e]">
            <strong>Asset ID:</strong> figma:asset/044683d680bab81b91974a32f614f0acede8855d.png
          </p>
        </div>
      </div>
    </div>
  );
}