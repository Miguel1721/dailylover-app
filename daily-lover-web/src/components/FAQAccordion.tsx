"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import faqsData from "@/data/faqs.json";
import { FAQItem } from "@/types";

export default function FAQAccordion() {
  const [openId, setOpenId] = useState<string | null>("faq-1");
  const faqs = faqsData as FAQItem[];

  const toggleFAQ = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section id="faqs" className="py-20 bg-neutral-50 border-t border-neutral-200/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#961500] bg-[#961500]/10 px-3.5 py-1.5 rounded-full">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>RESPUESTAS CLARAS</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
            Preguntas Frecuentes
          </h2>
          <p className="text-neutral-600 text-base">
            Resolvemos todas tus dudas antes de dar el paso.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className="bg-white rounded-2xl border border-neutral-200 overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 font-heading font-bold text-neutral-900 hover:text-[#961500] transition-colors"
                >
                  <span className="text-base sm:text-lg">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-neutral-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-[#961500]" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm sm:text-base text-neutral-600 leading-relaxed border-t border-neutral-100 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still have questions banner */}
        <div className="mt-12 text-center bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
          <h3 className="font-heading text-lg font-bold text-neutral-900">
            ¿Tienes alguna otra duda o consulta especial?
          </h3>
          <p className="text-sm text-neutral-600 max-w-md mx-auto">
            Escríbenos directamente a nuestro equipo de atención personalizada y te responderemos en minutos.
          </p>
          <a
            href="https://tally.so/r/wQQ0zg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 text-xs md:text-sm font-bold text-white bg-[#961500] hover:bg-[#731000] rounded-full transition-all shadow-sm"
          >
            Contacto Directo
          </a>
        </div>
      </div>
    </section>
  );
}
