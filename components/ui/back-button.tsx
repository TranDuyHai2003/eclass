"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
  variant?: "ghost" | "outline" | "default" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
  fallbackUrl?: string;
}

export const BackButton = ({
  className,
  variant = "ghost",
  size = "icon",
  children,
  fallbackUrl,
}: BackButtonProps) => {
  const router = useRouter();

  const handleBack = () => {
    // If there is history, go back. 
    // Otherwise, use fallbackUrl if provided.
    if (window.history.length > 2) {
      router.back();
    } else if (fallbackUrl) {
      router.push(fallbackUrl);
    } else {
      router.back(); // Fallback to standard back behavior
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBack}
      className={cn("rounded-xl", className)}
    >
      {children || <ArrowLeft className="w-5 h-5" />}
    </Button>
  );
};
