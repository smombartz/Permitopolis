/**
 * One lucide icon per party, tier, task kind and case state/ending, so every
 * screen that shows one of these draws the same icon. Color never carries the
 * meaning alone (CLAUDE.md, plan 3.2): every chip, badge and stepper marker
 * pairs its color with the icon from here and a label.
 */
import {
  BadgeCheckIcon,
  BanIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  CircleSlashIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileSearchIcon,
  FileTextIcon,
  HardHatIcon,
  HourglassIcon,
  LandmarkIcon,
  PartyPopperIcon,
  PenLineIcon,
  ReceiptIcon,
  SearchCheckIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  Undo2Icon,
  UserIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import type { CaseState, Dept, Ending, Party, TaskKind, Tier } from "@/lib/types";

export const PARTY_ICON: Record<Party, LucideIcon> = {
  applicant: UserIcon,
  clerk: LandmarkIcon,
  pws: HardHatIcon,
  hl: ShieldCheckIcon,
};

export const DEPT_ICON: Record<Dept, LucideIcon> = {
  clerk: PARTY_ICON.clerk,
  pws: PARTY_ICON.pws,
  hl: PARTY_ICON.hl,
};

export const TIER_ICON: Record<Tier, LucideIcon> = {
  instant: ZapIcon,
  reviewed: ClipboardCheckIcon,
  special: PartyPopperIcon,
};

export const TASK_KIND_ICON: Record<TaskKind, LucideIcon> = {
  document: FileTextIcon,
  form: ClipboardListIcon,
  action: CircleCheckIcon,
  payment: CreditCardIcon,
  sign_off: PenLineIcon,
  meeting: CalendarClockIcon,
  review: FileSearchIcon,
  inspection: SearchCheckIcon,
};

export const CASE_STATE_ICON: Record<CaseState, LucideIcon> = {
  draft: PenLineIcon,
  submitted: SendIcon,
  in_review: SearchIcon,
  needs_info: CircleHelpIcon,
  quote_sent: ReceiptIcon,
  permitted: BadgeCheckIcon,
  event_day: CalendarDaysIcon,
  closeout: ClipboardCheckIcon,
  closed: CircleCheckIcon,
};

export const ENDING_ICON: Record<Ending, LucideIcon> = {
  withdrawn: Undo2Icon,
  denied: BanIcon,
  cancelled: CircleSlashIcon,
  hold_expired: HourglassIcon,
};
