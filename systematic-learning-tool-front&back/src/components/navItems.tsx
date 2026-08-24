// ============================================================
// Shared navigation configuration used by both the desktop Header
// and the mobile bottom nav. Centralising means they can never
// drift out of sync again.
// ============================================================

import {
  BookOpen,
  FolderKanban,
  MessageSquareHeart,
  Settings as SettingsIcon,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Page } from "../types";

export interface NavItem {
  page: Page;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { page: "learn", label: "Learn", icon: BookOpen },
  { page: "projects", label: "Project", icon: FolderKanban },
  { page: "skills", label: "Skill", icon: Zap },
  { page: "feedback", label: "Feedback", icon: MessageSquareHeart },
  { page: "settings", label: "Settings", icon: SettingsIcon },
];