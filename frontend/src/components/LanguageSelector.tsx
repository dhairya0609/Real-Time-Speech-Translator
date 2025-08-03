import React, { useState } from "react";
import languageList from "../utils/languageList";

type Props = {
  value: string;
  onChange: (lang: string) => void;
  label?: string;
};

const LanguageSelector: React.FC<Props> = ({ value, onChange, label }) => {
  const [search, setSearch] = useState("");

  // Filter languages based on search
  const filtered = languageList.filter(
    (lang) =>
      lang.name.toLowerCase().includes(search.toLowerCase()) ||
      lang.code.toLowerCase().includes(search.toLowerCase())
  );

  // Handle Enter key press for language matching
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If there's an exact match, select it
      const exactMatch = languageList.find(
        lang => lang.code.toLowerCase() === search.toLowerCase() ||
                lang.name.toLowerCase() === search.toLowerCase()
      );
      
      if (exactMatch) {
        onChange(exactMatch.code);
        setSearch("");
        return;
      }
      
      // If there's a partial match, select the first one
      if (filtered.length > 0) {
        onChange(filtered[0].code);
        setSearch("");
        return;
      }
      
      // If no match, keep current language
      setSearch("");
    }
  };

  return (
    <div className="flex flex-col">
      {label && (
        <label className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">
          {label}
        </label>
      )}
      
      {/* Search Input */}
      <input
        type="text"
        placeholder="Search language..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyPress={handleKeyPress}
        className="w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      
      {/* Language Select */}
      <select
        value={value}
        onChange={(e) => {
          console.log("🌐 Language changed to:", e.target.value);
          onChange(e.target.value);
        }}
        className="w-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium"
      >
        {filtered.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;