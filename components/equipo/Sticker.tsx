"use client";

// The basket sticker for a small label printer (2.25 × 1.25 in): big
// floor-line letter, #number, name, QR for the Saturday scan.
//
// printOnly: hidden on screen; when the page prints, ONLY the sticker
// prints (everything else on the page is hidden), so the Thursday station
// can print without opening a new tab (which made iPhones reload the page).

export default function Sticker({
  id,
  number,
  letter,
  name,
  printOnly = false,
  onQrReady,
}: {
  id: string;
  number: number;
  letter: string;
  name: string;
  printOnly?: boolean;
  onQrReady?: () => void;
}) {
  return (
    <>
      <style>{`
        .stk { width: 2.25in; height: 1.25in; box-sizing: border-box; padding: 0.06in 0.08in; display: flex; align-items: center; gap: 0.08in; color: #000; background: #fff; font-family: var(--font-heading, Georgia), Georgia, serif; overflow: hidden; }
        .stk__l { width: 0.78in; height: 1.05in; border-radius: 0.08in; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8in; line-height: 1; flex: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .stk__m { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
        .stk__n { font-size: 0.34in; line-height: 1; }
        .stk__name { font-family: system-ui, sans-serif; font-size: 0.13in; line-height: 1.15; margin-top: 0.04in; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .stk__q { width: 0.62in; height: 0.62in; flex: none; }
        .stk-print { display: none; }
        @media print {
          @page { size: 2.25in 1.25in; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .stk-print, .stk-print *, .stk-screen, .stk-screen * { visibility: visible !important; }
          .stk-print { display: block !important; }
          .stk-print, .stk-screen { position: fixed !important; left: 0; top: 0; }
        }
      `}</style>
      <div className={printOnly ? "stk-print" : "stk-screen"}>
        <div className="stk" role="img" aria-label={`Calcomanía: fila ${letter}, canasta ${number}, ${name}`}>
          <div className="stk__l">{letter}</div>
          <div className="stk__m">
            <span className="stk__n">#{number}</span>
            <span className="stk__name">{name}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="stk__q" src={"/api/equipo/qr?b=" + id} alt="" onLoad={onQrReady} onError={onQrReady} />
        </div>
      </div>
    </>
  );
}
