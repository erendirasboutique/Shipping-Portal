"use client";

import Shell from "@/components/Shell";
import ShippingMap from "@/components/ShippingMap";

export default function MapPage() {
  return (
    <Shell>
      <div className="card !rounded-[2rem] !p-6 md:!p-8">
        <p className="eyebrow">Where your packages go</p>
        <h1 className="mt-1 text-5xl">Shipping Map</h1>
        <div className="mt-6">
          <ShippingMap />
        </div>
      </div>
    </Shell>
  );
}
