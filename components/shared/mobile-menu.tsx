"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatSelector } from "./chat-selector";
import { useAuth } from "@clerk/nextjs";

interface MobileMenuProps {
  onInfoDialogOpen: () => void;
}

export function MobileMenu({ onInfoDialogOpen }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { isSignedIn } = useAuth();

  const openMenu = () => {
    setIsOpen(true);
    requestAnimationFrame(() => {
      setIsAnimating(true);
    });
  };

  const closeMenu = () => {
    setIsAnimating(false);
    setTimeout(() => setIsOpen(false), 300);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeMenu();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden h-8 w-8 p-0"
        onClick={openMenu}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out ${
              isAnimating ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeMenu}
          />

          <div
            className={`fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-black border-l border-border shadow-lg transform transition-transform duration-300 ease-out ${
              isAnimating ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex flex-col h-full">
              <div className="absolute top-4 right-4 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={closeMenu}
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close menu</span>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pt-16 space-y-4">
                {isSignedIn && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Your Chats
                    </h3>
                    <div className="w-full">
                      <ChatSelector />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-3 text-left"
                    onClick={() => {
                      onInfoDialogOpen();
                      closeMenu();
                    }}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Info className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium">About CodeFrame</div>
                        <div className="text-sm text-muted-foreground">
                          Learn about the platform
                        </div>
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
