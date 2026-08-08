import EventsGrid from "@/components/EventsGrid";
import FAQAccordion from "@/components/FAQAccordion";
import Newsletter from "@/components/Newsletter";

export default function EventosPage() {
  return (
    <div className="bg-white">
      {/* Header Banner */}
      <section className="py-16 bg-neutral-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[#961500] bg-[#961500]/20 px-3.5 py-1.5 rounded-full border border-[#961500]/40">
            AGENDA SOCIAL & EXPERIENCIAS
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight">
            Próximos Eventos Daily Lover
          </h1>
          <p className="text-neutral-300 text-base sm:text-lg max-w-2xl mx-auto">
            Encuentros temáticos, catas de vino, toros de polo y mixers privados en Colombia, Miami, Madrid y México.
          </p>
        </div>
      </section>

      <EventsGrid initialCity="all" />
      <FAQAccordion />
      <Newsletter />
    </div>
  );
}
