import React from "react";
import FounderSection from "@/components/FounderSection";
import Newsletter from "@/components/Newsletter";

export const metadata = {
  title: "Nosotros & Fundadora — Daily Lover",
  description: "Conoce a María Paula Salinas, fundadora de Daily Lover, y la visión detrás de nuestro club de citas.",
};

export default function NosotrosPage() {
  return (
    <div className="py-6">
      <FounderSection />
      <Newsletter />
    </div>
  );
}
