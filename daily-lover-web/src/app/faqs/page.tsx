import React from "react";
import FAQAccordion from "@/components/FAQAccordion";
import Newsletter from "@/components/Newsletter";

export const metadata = {
  title: "Preguntas Frecuentes — Daily Lover",
  description: "Resuelve todas tus dudas sobre nuestro matchmaking, blind dates y eventos para solteros.",
};

export default function FAQsPage() {
  return (
    <div className="py-6">
      <FAQAccordion />
      <Newsletter />
    </div>
  );
}
