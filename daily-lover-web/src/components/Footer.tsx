"use client";

import React from "react";
import Link from "next/link";
import { Heart, Globe } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-neutral-950 text-neutral-400 border-t border-neutral-800 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-neutral-800">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#961500] text-white flex items-center justify-center font-bold">
                <Heart className="w-4 h-4 fill-current" />
              </div>
              <span className="font-heading text-lg font-bold text-white tracking-tight">
                DAILY LOVER
              </span>
            </Link>

            <p className="text-sm text-neutral-400 max-w-sm leading-relaxed">
              El club social de solteros y citas a ciegas más exclusivo. Conectando personas auténticas a través de eventos curados y matchmaking profesional en Colombia, Miami, Madrid y CDMX.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://www.instagram.com/dailylover______/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-[#961500] text-white text-xs font-semibold transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>@dailylover______</span>
              </a>
              <a
                href="https://www.dailylover.org"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-[#961500] text-white flex items-center justify-center transition-colors"
                aria-label="Website"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Ciudades */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Ciudades
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Colombia (Bogotá &amp; Medellín)
                </Link>
              </li>
              <li>
                <Link href="/miami" className="hover:text-white transition-colors">
                  Miami, USA
                </Link>
              </li>
              <li>
                <Link href="/madrid" className="hover:text-white transition-colors">
                  Madrid, España
                </Link>
              </li>
              <li>
                <Link href="/cdmx" className="hover:text-white transition-colors">
                  Ciudad de México
                </Link>
              </li>
            </ul>
          </div>

          {/* Experiencias */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Experiencias
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/eventos" className="hover:text-white transition-colors">
                  Eventos Sociales &amp; Catas
                </Link>
              </li>
              <li>
                <Link href="/blind-date" className="hover:text-white transition-colors">
                  Citas a Ciegas 1 a 1
                </Link>
              </li>
              <li>
                <a
                  href="https://mariapaulasalinasg.substack.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Newsletter (Substack)
                </a>
              </li>
              <li>
                <a
                  href="https://tally.so/r/wQQ0zg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Formulario de Match
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Legal &amp; Registro
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terminos" className="hover:text-white transition-colors">
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <a
                  href="https://dailylover.smartmatchapp.com/sf63"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  SmartMatchApp Portal
                </a>
              </li>
              <li>
                <a
                  href="https://tally.so/r/NpJaGp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Lista de Espera Cali
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <p>
            © {new Date().getFullYear()} Daily Lover. Todos los derechos reservados.
          </p>
          <p className="flex items-center gap-1">
            Diseñado con <Heart className="w-3 h-3 text-[#961500] fill-current inline" /> para relaciones auténticas.
          </p>
        </div>
      </div>
    </footer>
  );
}
