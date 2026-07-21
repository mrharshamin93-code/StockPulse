import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Shared sub-page header with a centered title and
 * the same minimal back button used on Stock Detail.
 *
 * @param {string} title - Page title shown in the center.
 * @param {string} [backPath] - Optional route to navigate to.
 */
export default function SubPageHeader({
  title,
  backPath,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
      return;
    }

    navigate(-1);
  };

  return (
    <header
      className="sticky top-0 z-10 border-b border-gray-100 bg-white"
      style={{
        paddingTop:
          "env(safe-area-inset-top)",
      }}
    >
      <div className="mx-auto flex max-w-4xl items-center px-2 py-3 sm:px-4">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="inline-flex min-h-[36px] min-w-[64px] items-center gap-1.5 px-2 py-1.5 text-sm font-semibold text-gray-900 transition-all hover:opacity-70 active:scale-95"
        >
          <ArrowLeft
            className="h-4 w-4 shrink-0"
            strokeWidth={2}
          />

          Back
        </button>

        <h1 className="flex-1 truncate px-2 text-center font-heading text-base font-semibold tracking-tight">
          {title}
        </h1>

        <div
          className="min-w-[64px]"
          aria-hidden="true"
        />
      </div>
    </header>
  );
}
