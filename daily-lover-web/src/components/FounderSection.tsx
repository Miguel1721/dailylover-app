"use client";

import React from "react";
import Image from "next/image";

export default function FounderSection() {
  return (
    <section id="fundadora" className="py-16 md:py-24 bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="mb-10">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-[#961500] tracking-tight">
            María Paula Salinas
          </h3>
          <p className="text-xl sm:text-2xl font-bold text-neutral-900">
            Founder
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Founder Photo */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/5] bg-neutral-100 border border-neutral-200">
              <Image
                src="/images/hero_miami.jpeg"
                alt="María Paula Salinas - Founder de Daily Lover"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
              />
            </div>
          </div>

          {/* Founder Content Text */}
          <div className="lg:col-span-7 space-y-6 pt-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
              ¿Quién soy yo?
            </h2>

            <div className="space-y-5 text-neutral-600 text-base leading-relaxed">
              <p>
                Yo también he tenido citas que dan pena ajena, y conversaciones eternas que nunca llegaron a nada. Empecé como creadora de contenido hablando sin filtro de lo que nadie se atreve a decir sobre el amor, las relaciones y la tusa. Hoy, con más de 600k personas siguiéndome la corriente, decidí llevar esa misma energía a la vida real: conectar a gente que sí quiere sentir, no solo coleccionar likes.
              </p>
              <p>
                Yo me cansé de ver cómo el dating se volvió un jueguito de validación y algoritmos que no entienden nada de química humana. Así que le di un giro a Daily Lover: un club íntimo de citas donde no dependes de un swipe, sino de experiencias diseñadas para que fluyan las conversaciones y aparezcan conexiones de verdad.
              </p>
              <p>
                Yo no vengo a venderte “el amor de tu vida”. Vengo a cambiar la forma en que lo buscas. Daily Lover es para los que saben que la magia está en la gente, no en la pantalla.
              </p>
            </div>

            <div className="pt-4">
              <a
                href="https://wa.me/573000000000?text=Hola%20Maria%20Paula,%20quiero%20saber%20mas%20de%20Daily%20Lover"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-7 py-3 rounded-full bg-[#961500] hover:bg-[#781100] text-white font-bold text-sm tracking-wide transition-all shadow-md hover:shadow-lg"
              >
                Habla conmigo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

