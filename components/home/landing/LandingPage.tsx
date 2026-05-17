import { LandingHero } from "./LandingHero";
import { SkillTree } from "./SkillTree";
import { SocialProof } from "./SocialProof";

export async function LandingPage({ courses }: { courses: any[] }) {
  return (
    <div className="bg-[#0F172A] overflow-x-hidden min-h-screen">
      <LandingHero />
      <SkillTree />
      <SocialProof />
      
      <div className="py-20 text-center text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
         thatdehoctoan © 2026 • Design by Premium UI
      </div>
    </div>
  );
}
