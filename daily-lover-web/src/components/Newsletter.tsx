"use client";

import React, { useState } from "react";
import { Mail, Send, CheckCircle } from "lucide-react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setStatus("success");
    }
  };

  return (
    <section className="py-16 bg-[#961500] text-white relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
          <Mail className="w-4 h-4" />
          <span>LISTA VIP & EVENTOS PRIVADOS</span>
        </div>

        <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
          Entérate antes que nadie de los nuevos eventos
        </h2>

        <p className="text-white/80 text-base sm:text-lg max-w-2xl mx-auto">
          Los cupos para nuestros encuentros grupales y catas se agotan rápidamente. Suscríbete para recibir invitaciones prioritarias según tu ciudad.
        </p>

        {status === "idle" ? (
          <form
            onSubmit={handleSubmit}
            className="max-w-md mx-auto flex flex-col sm:flex-row gap-3 pt-2"
          >
            <input
              type="email"
              required
              placeholder="Tu correo electrónico..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-5 py-3.5 rounded-full text-neutral-900 bg-white placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="px-7 py-3.5 rounded-full font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-all text-sm shrink-0 flex items-center justify-center gap-2 shadow-lg"
            >
              <span>Unirme VIP</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#961500] font-bold text-sm">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>¡Gracias por unirte! Te notificaremos a tu correo.</span>
          </div>
        )}

        <p className="text-xs text-white/60">
          Cero spam. Puedes darte de baja en cualquier momento con un clic.
        </p>
      </div>
    </section>
  );
}
