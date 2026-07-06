"use client";

import { MobileHeader } from "@/components/mobile/header";
import Link from "next/link";
import { ChevronRight, Check } from "lucide-react";

export default function LeadsCategoriesPage() {
  const categories = [
    {
      title: "All",
      description: "All leads at one place",
      href: "/leads/category/all",
    },
    {
      title: "Uncontacted",
      description: "Leads, which haven't been called so far",
      href: "/leads/category/uncontacted",
    },
    {
      title: "In-Progress",
      description: "Leads that are in progress and not yet closed",
      href: "/leads/category/in-progress",
    },
    {
      title: "Follow-up",
      description: "Leads, which are scheduled to be called later",
      href: "/leads/category/follow-up",
    },
    {
      title: "Not Connected",
      description: "Leads, which were not connected in previous attempt",
      href: "/leads/category/not-connected",
    },
  ];

  return (
    <div className="min-h-full bg-neutral-50/50 flex flex-col">
      <MobileHeader title="My Leads" />

      <div className="flex-1 p-5 pt-6 space-y-4">
        {/* Refresh indicator */}
        <div className="flex items-center justify-center gap-2 text-neutral-400 font-medium text-sm mb-6">
          <Check className="h-4 w-4" />
          <span>Refresh completed</span>
        </div>

        {/* Category List */}
        <div className="space-y-4">
          {categories.map((cat) => (
            <Link
              key={cat.title}
              href={cat.href}
              className="group flex items-center justify-between rounded-2xl bg-white p-5 text-neutral-900 shadow-[0_0_20px_rgba(0,0,0,0.15)] border border-neutral-200/60 active:scale-[0.99] active:bg-neutral-50 transition-all"
            >
              <div className="pr-4">
                <h3 className="text-lg font-semibold tracking-tight">{cat.title}</h3>
                <p className="text-sm font-medium text-neutral-500 mt-1 opacity-90 line-clamp-1">{cat.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-neutral-400 group-hover:text-neutral-600 transition-colors shrink-0" strokeWidth={2.5} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
