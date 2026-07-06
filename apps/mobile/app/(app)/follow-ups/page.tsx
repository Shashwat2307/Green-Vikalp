"use client";

import { MobileHeader } from "@/components/mobile/header";
import { ChevronDown, PhoneCall } from "lucide-react";

export default function FollowUpsPage() {
  return (
    <div className="flex h-screen flex-col bg-brand-50 relative pb-[70px]">
      <MobileHeader title="Follow-up" />

      <div className="flex flex-col flex-1">
        {/* Filters */}
        <div className="flex gap-2 p-4 bg-white border-b border-brand-100">
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-brand-200 bg-white">
            <span className="text-sm font-medium text-brand-900">Today</span>
            <ChevronDown className="h-4 w-4 text-brand-400" />
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-brand-200 bg-white">
            <span className="text-sm font-medium text-brand-900">Follow-up Type</span>
            <ChevronDown className="h-4 w-4 text-brand-400" />
          </button>
        </div>

        {/* Empty State */}
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 rounded-full bg-brand-100 p-6 shadow-inner">
            <PhoneCall className="h-16 w-16 text-brand-600 rotate-[-15deg]" strokeWidth={2.5} />
          </div>
          <p className="text-lg text-brand-900">No follow-ups due Today</p>
        </div>
      </div>
    </div>
  );
}
