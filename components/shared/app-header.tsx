"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatSelector } from "./chat-selector";
import { MobileMenu } from "./mobile-menu";
import { UserNav } from "@/components/user-nav";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAuth,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";

interface AppHeaderProps {
  className?: string;
}

function SearchParamsHandler() {
  return null;
}

export function AppHeader({ className = "" }: AppHeaderProps) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const isHomepage = pathname === "/";
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);

  const handleLogoClick = (e: React.MouseEvent) => {
    if (isHomepage) {
      e.preventDefault();
      window.location.href = "/?reset=true";
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Suspense fallback={null}>
        <SearchParamsHandler />
      </Suspense>

      <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Corner: Logo Only */}
          <div className="flex items-center">
            <Link
              href="/"
              onClick={handleLogoClick}
              className="flex items-center group transition-transform hover:scale-105"
            >
              <img
                src="/logo.png"
                alt="CodeFrame"
                className="h-10 w-auto sm:h-12 object-contain"
              />
            </Link>
          </div>

          {/* Right Corner: All Buttons */}
          <div className="flex items-center gap-3">
            {/* Chat Selector - Desktop */}
            <div className="hidden lg:block">
              <ChatSelector />
            </div>

            {/* Info Button - Desktop */}
            <Button
              variant="outline"
              size="sm"
              className="hidden lg:flex gap-2 bg-transparent border-white/20 text-white hover:bg-white/10 hover:border-white/30"
              onClick={() => setIsInfoDialogOpen(true)}
            >
              <Info size={16} />
              About
            </Button>

            {/* Auth Buttons - Desktop */}
            <div className="hidden lg:flex items-center gap-2">
              <SignedIn>
                <UserNav />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/10"
                  >
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button
                    size="sm"
                    className="bg-white text-black hover:bg-white/90"
                  >
                    Get Started
                  </Button>
                </SignUpButton>
              </SignedOut>
            </div>

            {/* Mobile Menu */}
            <div className="flex lg:hidden items-center gap-2">
              {isSignedIn && <UserNav />}
              <MobileMenu onInfoDialogOpen={() => setIsInfoDialogOpen(true)} />
            </div>
          </div>
        </div>
      </div>

      {/* Light-Dark-Light Border Line */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

      {/* Info Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl bg-black border border-white/20">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-white mb-6">
              CodeFrame Platform
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <p className="text-base text-gray-300 leading-relaxed">
              CodeFrame is an advanced AI coding assistant designed to help
              developers build better software faster.
            </p>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <p className="text-base text-gray-300 leading-relaxed">
                Created by{" "}
                <strong className="text-white font-semibold">
                  Suryanshu Nabheet
                </strong>
                , it features real-time code generation, streaming responses,
                and a premium user interface.
              </p>
            </div>
            <p className="text-sm text-gray-400">
              Powered by the latest AI models and built on a robust, modern
              stack.
            </p>
          </div>
          <div className="flex gap-3 mt-8">
            <Button
              onClick={() => setIsInfoDialogOpen(false)}
              className="flex-1 bg-white text-black hover:bg-white/90"
            >
              Start Coding
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsInfoDialogOpen(false)}
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
