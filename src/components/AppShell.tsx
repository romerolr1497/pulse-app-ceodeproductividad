"use client";

import { StoreProvider } from "@/lib/store";
import { Sidebar, MobileNav } from "./Navigation";
import { NotificationScheduler } from "./NotificationScheduler";
import { CommandPalette } from "./CommandPalette";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <NotificationScheduler />
      <CommandPalette />
      <div className="flex h-full">
        <Sidebar />
        <main className="flex-1 lg:ml-[72px] xl:ml-60 min-h-full overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
        <MobileNav />
      </div>
    </StoreProvider>
  );
}
