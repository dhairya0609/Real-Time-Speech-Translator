import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GlobeAltIcon, ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import languageList from "../utils/languageList";

type Props = {
  value: string;
  onChange: (lang: string) => void;
  label?: string;
};

const LanguageSelector: React.FC<Props> = ({ value, onChange, label }) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current language info
  const currentLang = languageList.find(lang => lang.code === value);

  // Filter languages based on search
  const filtered = languageList.filter(
    (lang) =>
      lang.name.toLowerCase().includes(search.toLowerCase()) ||
      lang.code.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking inside the button or dropdown
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Open dropdown when typing in search
  useEffect(() => {
    if (search.trim()) {
      setIsOpen(true);
    }
  }, [search]);

  // Handle language selection
  const handleLanguageSelect = (langCode: string) => {
    console.log("🌐 Language changed to:", langCode);
    onChange(langCode);
    setIsOpen(false);
    setSearch("");
  };

  // Handle Enter key press for language matching (optional)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If there's an exact match, select it
      const exactMatch = languageList.find(
        lang => lang.code.toLowerCase() === search.toLowerCase() ||
                lang.name.toLowerCase() === search.toLowerCase()
      );
      
      if (exactMatch) {
        handleLanguageSelect(exactMatch.code);
        return;
      }
      
      // If there's a partial match, select the first one
      if (filtered.length > 0) {
        handleLanguageSelect(filtered[0].code);
        return;
      }
      
      // If no match, keep current language
      setSearch("");
    }
  };

  return (
    <div className="flex flex-col">
      {label && (
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <GlobeAltIcon className="w-4 h-4 text-violet-500" />
          {label}
        </label>
      )}
      
      {/* Search Input - Always Visible */}
      <input
        type="text"
        placeholder="Search language..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyPress={handleKeyPress}
        className="w-64 px-3 py-2 input-glass text-sm focus:ring-2 focus:ring-violet-500/50 mb-2"
      />
      
      {/* Modern Pill-style Language Selector */}
      <div className="relative">
        {/* Selected Language Display */}
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="w-64 px-3 py-2 input-glass flex items-center justify-between text-left transition-all duration-300 hover:shadow-lg focus:ring-2 focus:ring-violet-500/50"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentLang?.flag || "🌐"}</span>
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                {currentLang?.name || "Select Language"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {currentLang?.code.toUpperCase()}
              </div>
            </div>
          </div>
          <ChevronDownIcon 
            className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`} 
          />
        </button>

        {/* Dropdown rendered via Portal */}
        {isOpen && createPortal(
          <div 
            ref={dropdownRef}
            className="fixed card-glass max-h-80 overflow-hidden z-[99999] shadow-2xl"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: '320px'
            }}
          >
            {/* Language Options */}
            <div className="max-h-60 overflow-y-auto">
              {filtered.map((lang) => (
                <button
                  key={lang.code}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLanguageSelect(lang.code);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-all duration-200 hover:bg-violet-500/10 ${
                    lang.code === value 
                      ? "bg-violet-500/20 text-violet-700 dark:text-violet-300" 
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <div>
                    <div className="font-medium text-sm">{lang.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {lang.code.toUpperCase()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default LanguageSelector;