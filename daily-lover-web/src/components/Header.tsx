"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Heart } from "lucide-react";
import CitySelector from "./CitySelector";

interface HeaderProps {
  currentCityId?: string;
}

export default function Header({ currentCityId = "colombia" }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-200 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-neutral-100 py-3"
          : "bg-white py-4 border-b border-neutral-100"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full bg-[#961500] text-white transition-transform group-hover:scale-105">
              <Heart className="w-4 h-4 md:w-5 md:h-5 fill-current" />
            </div>
            <span className="font-heading text-lg md:text-xl font-bold tracking-tight text-neutral-900">
              DAILY LOVER
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-700">
            <Link
              href="/eventos"
              className="hover:text-[#961500] transition-colors"
            >
              Eventos
            </Link>
            <Link
              href="/blind-date"
              className="hover:text-[#961500] transition-colors"
            >
              Blind Date
            </Link>
            <Link
              href="/como-funciona"
              className="hover:text-[#961500] transition-colors"
            >
              Cómo Funciona
            </Link>
            <Link
              href="/nosotros"
              className="hover:text-[#961500] transition-colors"
            >
              Nosotros
            </Link>
            <Link
              href="/faqs"
              className="hover:text-[#961500] transition-colors"
            >
              FAQs
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-4">
            <CitySelector currentCityId={currentCityId} variant="header" />
            <a
              href="https://tally.so/r/wQQ0zg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 text-xs md:text-sm font-semibold text-white bg-[#961500] hover:bg-[#731000] rounded-full transition-all shadow-sm hover:shadow"
            >
              Aplica al Club
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <CitySelector currentCityId={currentCityId} variant="header" />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-neutral-700 hover:text-neutral-900 rounded-lg"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-neutral-100 space-y-3 pb-2 animate-in fade-in slide-in-from-top-2">
            <Link
              href="/eventos"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-neutral-800 hover:text-[#961500]"
            >
              Eventos
            </Link>
            <Link
              href="/blind-date"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-neutral-800 hover:text-[#961500]"
            >
              Blind Date (Cita a Ciegas)
            </Link>
            <Link
              href="/como-funciona"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-neutral-800 hover:text-[#961500]"
            >
              Cómo Funciona
            </Link>
            <Link
              href="/nosotros"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-neutral-800 hover:text-[#961500]"
            >
              Nosotros
            </Link>
            <Link
              href="/faqs"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-base font-medium text-neutral-800 hover:text-[#961500]"
            >
              Preguntas Frecuentes
            </Link>
            <div className="pt-2">
              <a
                href="https://tally.so/r/wQQ0zg"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-[#961500] hover:bg-[#731000] rounded-full text-center"
              >
                Aplica al Club
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
