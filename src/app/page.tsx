"use client";

import { Timeline } from "@/components/Timeline";
import { TaskList } from "@/components/TaskList";
import { DayProgress } from "@/components/DayProgress";
import { QuickStats } from "@/components/QuickStats";
import { LiveHeader } from "@/components/LiveHeader";
import { DailyNote } from "@/components/DailyNote";

export default function Home() {
  return (
    <div className="p-4 lg:p-6 xl:p-8 max-w-[1400px] mx-auto">
      <LiveHeader />

      {/* Bento grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
        {/* Row 1: Progress + Quick Stats */}
        <div className="lg:col-span-5 xl:col-span-4">
          <DayProgress />
        </div>
        <div className="lg:col-span-7 xl:col-span-8">
          <QuickStats />
        </div>

        {/* Row 2: Timeline + Tasks */}
        <div className="lg:col-span-7 xl:col-span-8">
          <Timeline />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <TaskList />
        </div>

        {/* Row 3: Nota del día */}
        <div className="lg:col-span-12">
          <DailyNote />
        </div>
      </div>
    </div>
  );
}
