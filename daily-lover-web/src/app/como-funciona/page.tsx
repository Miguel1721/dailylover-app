import React from "react";
import HowItWorks from "@/components/HowItWorks";
import Newsletter from "@/components/Newsletter";

export const metadata = {
  title: "Cómo Funciona — Daily Lover",
  description: "Conoce nuestro proceso de 6 pasos para citas a ciegas y experiencias sociales curadas.",
};

export default function ComoFuncionaPage() {
  return (
    <div className="py-6">
      <HowItWorks />
      <Newsletter />
    </div>
  );
}
