import React from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Unified sub-page header with centered title and native-feeling back button.
 * @param {string} title - Page title (centered)
 * @param {string} [backPath] - If provided, navigate here on back tap; otherwise goes back in history
 */
export default function SubPageHeader({ title, backPath }) {
  const navigate = useNavigate();
  const handleBack = () => (backPath ? navigate(backPath) : navigate(-1));

  return (
    <header
      className="bg-white border-b border-gray-100 sticky top-0 z-10"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-3 flex items-center">
        {/* Back button — fixed-width left slot */}
        <button
          onClick={handleBack}
          className="flex items-center gap-0.5 text-sm font-medium text-gray-900 hover:text-gray-500 transition-colors min-w-[64px] min-h-[44px] px-2 -ml-1"
        >
          <ChevronLeft className="w-5 h-5 shrink-0" />
          Back
        </button>

        {/* Centered title */}
        <h1 className="flex-1 text-center font-heading text-base font-semibold tracking-tight truncate px-2">
          {title}
        </h1>

        {/* Right spacer — mirrors left button width so title stays truly centred */}
        <div className="min-w-[64px]" />
      </div>
    </header>
  );
}