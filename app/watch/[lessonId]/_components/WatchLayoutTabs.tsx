"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, MessageSquare, Info } from "lucide-react";

interface WatchLayoutTabsProps {
  descriptionSlot: React.ReactNode;
  curriculumSlot: React.ReactNode;
}

export function WatchLayoutTabs({
  descriptionSlot,
  curriculumSlot,
}: WatchLayoutTabsProps) {
  return (
    <div className="w-full mt-6">
      <Tabs defaultValue="curriculum" className="w-full">
        <TabsList className="w-full flex sm:w-fit bg-slate-100/80 p-1.5 rounded-2xl mx-auto sm:mx-0">
          <TabsTrigger 
            value="curriculum" 
            className="flex-1 sm:flex-none rounded-xl text-xs font-black uppercase tracking-wider py-2.5 px-4 sm:px-6 data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm transition-all text-slate-500"
          >
            <BookOpen className="w-4 h-4 mr-2 hidden sm:inline-block" />
            Lộ trình học
          </TabsTrigger>
          <TabsTrigger 
            value="description" 
            className="flex-1 sm:flex-none rounded-xl text-xs font-black uppercase tracking-wider py-2.5 px-4 sm:px-6 data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm transition-all text-slate-500"
          >
            <Info className="w-4 h-4 mr-2 hidden sm:inline-block" />
            Mô tả
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-8">
          <TabsContent value="curriculum" className="outline-none focus:outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
            {curriculumSlot}
          </TabsContent>
          <TabsContent value="description" className="outline-none focus:outline-none animate-in fade-in slide-in-from-bottom-2 duration-500">
            {descriptionSlot}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
