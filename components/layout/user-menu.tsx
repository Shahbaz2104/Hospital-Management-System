"use client";

import { useRouter } from "next/navigation";
import { LogOut, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";

import type { SessionUser } from "@/lib/auth/session";
import { apiPost } from "@/lib/api";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SETTINGS_ROLES = new Set(["SUPER_ADMIN", "HOSPITAL_ADMIN"]);

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`;

  async function logout() {
    try {
      await apiPost("/auth/logout");
    } catch {
      // still navigate away on failure
    }
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-2"
          aria-label="Account menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] flex-col items-start leading-tight sm:flex">
            <span className="w-full truncate text-sm font-medium">
              {user.firstName} {user.lastName}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {user.roleLabel}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate">
              {user.firstName} {user.lastName}
            </span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </span>
          <Badge variant="secondary" className="ml-auto shrink-0">
            {user.roleName.replace("_", " ")}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <UserRound className="size-4" /> Profile
        </DropdownMenuItem>
        {SETTINGS_ROLES.has(user.roleName) && (
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="size-4" /> Settings
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}