"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  BellIcon,
  FileQuestionIcon,
  InboxIcon,
  PaletteIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"
import { Chip, ChipDot } from "@/components/ui/chip"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Kbd } from "@/components/ui/kbd"
import { Banner } from "@/components/ui/banner"
import { Callout } from "@/components/ui/callout"
import { EmptyState } from "@/components/ui/empty-state"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Field } from "@/components/ui/field"
import { FileDrop } from "@/components/ui/file-drop"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Stat } from "@/components/ui/stat"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { Toaster } from "@/components/ui/sonner"
import { PageHeader } from "@/components/ui/page-header"
import { Section } from "@/components/ui/section"
import { KeyValueList } from "@/components/ui/key-value"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { WizardStepper } from "@/components/ui/wizard-stepper"
import { FilterBar, FilterChip } from "@/components/ui/filter-bar"
import { CountBadge } from "@/components/ui/count-badge"
import { Toolbar } from "@/components/ui/toolbar"
import { Progress } from "@/components/ui/progress"
import { InlineAlert } from "@/components/ui/inline-alert"
import { StickyAside } from "@/components/ui/sticky-aside"
import { Truncate } from "@/components/ui/truncate"
import { CopyButton } from "@/components/ui/copy-button"

import {
  ActivityTimeline,
  AvailabilityBadge,
  CASE_STATE_ICON,
  CaseHeader,
  CaseId,
  ConditionList,
  DateText,
  DeptStatusDots,
  DueDate,
  ENDING_ICON,
  EndingBanner,
  EventTitle,
  FeeTable,
  HoldStatus,
  LeadTimeRisk,
  Money,
  PARTY_ICON,
  PartyAvatar,
  PartyChip,
  PersonaAvatar,
  REVIEW_STATUS_TEXT,
  ReviewClock,
  ReviewStatusDot,
  StackedTaskCard,
  StateChip,
  StateStepper,
  TASK_KIND_ICON,
  TIER_ICON,
  TaskCard,
  TaskKindLabel,
  TierBadge,
  WaitingOnChips,
  WhoIsUp,
} from "@/components/domain"
import {
  DEPTS,
  ENDING_LABEL,
  PARTIES,
  PARTY_LABEL,
  STATE_LABEL,
  type Activity,
  type CaseState,
  type Condition,
  type Ending,
  type FeeLine,
  type FileRef,
  type Party,
  type ReviewStatus,
  type Task,
  type TaskKind,
  type Tier,
} from "@/lib/types"
import type { PartyStatus } from "@/lib/state/types"

// The kit runs outside app/layout.tsx when mounted by the render test, so it
// brings its own demo date instead of importing lib/state (another workstream's
// store, which does not exist in this worktree).
const DEMO_TODAY = "2027-05-03";
const TIERS: Tier[] = ["instant", "reviewed", "special"];
const CASE_STATES = Object.keys(STATE_LABEL) as CaseState[];
const ENDINGS = Object.keys(ENDING_LABEL) as Ending[];
const TASK_KINDS = Object.keys(TASK_KIND_ICON) as TaskKind[];
const REVIEW_STATUSES: ReviewStatus[] = [
  "not_routed",
  "pending",
  "approved",
  "approved_with_conditions",
  "needs_info",
  "denied",
];
const SAMPLE_FILE: FileRef = { name: "sample-insurance.pdf", size: 248_000, type: "application/pdf" };

// ---- Stress-row samples for Part 3 of workstream 2D: a 90+ character event name, a 60+
// character organization name, missing fields, overdue dates and an ended case, all shown
// somewhere below so the kit is the single place to judge the system against them.
const LONG_EVENT_NAME =
  "Riverside Park Community Spring Festival, Craft Fair, Food Truck Rally and Live Music Celebration Day";
const LONG_ORG_NAME = "Permitopolis Riverside Neighborhood Association and Community Partners Coalition";

function sampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "PMT-27-0118:sample",
    catalogId: "sample",
    owner: "applicant",
    kind: "document",
    title: "Upload certificate of insurance",
    why: "Every Reviewed and Special event needs this.",
    reviewer: "hl",
    dueDate: "2027-05-05",
    status: "todo",
    unlocksOn: null,
    phase: "before_submitting",
    payload: {},
    history: [],
    tags: [],
    ...overrides,
  };
}

const SAMPLE_TASKS: Task[] = [
  sampleTask({
    id: "t-overdue",
    title: "Respond to a request",
    why: "Health & Legal asked for the updated vendor list.",
    dueDate: "2027-04-20",
    request: {
      from: "hl",
      message: "The vendor list is missing Rolling Dumpling Co.'s contact information.",
      at: "2027-04-18T09:00",
      dueDate: "2027-04-20",
      resolved: false,
    },
  }),
  sampleTask({
    id: "t-locked",
    kind: "action",
    title: "Accept conditions and sign",
    why: "Unlocks once your quote is ready.",
    status: "locked",
    unlocksOn: "quote_sent",
    dueDate: null,
    reviewer: null,
  }),
  sampleTask({
    id: "t-signoff",
    kind: "sign_off",
    title: "Neighbor sign-off",
    why: "Block parties need every neighbor to sign off before the Clerk can accept.",
    reviewer: "clerk",
    dueDate: null,
    payload: { progress: { done: 9, total: 12 } },
  }),
  sampleTask({
    id: "t-payment",
    kind: "payment",
    title: "Pay fees and deposit",
    why: "Your quote is ready.",
    reviewer: "clerk",
    dueDate: "2027-05-14",
    payload: { amount: 6530 },
  }),
  sampleTask({
    id: "t-done",
    title: "Vendor list",
    why: "Because you added food vending.",
    reviewer: "hl",
    status: "done",
    dueDate: "2027-04-30",
  }),
  // A finished card with a history says when it was finished.
  sampleTask({
    id: "t-done-dated",
    title: "Certificate of insurance",
    why: "Every reviewed event needs proof of liability insurance",
    reviewer: "hl",
    status: "done",
    history: [
      { at: "2027-04-16T09:05", actor: "applicant", status: "submitted" },
      { at: "2027-04-21T11:00", actor: "hl", status: "done" },
    ],
  }),
  // Locked, with the day it is for under the unlock hint.
  sampleTask({
    id: "t-locked-dated",
    kind: "action",
    title: "Carry your permit",
    why: "Have your permit on your phone on the day",
    status: "locked",
    unlocksOn: "event_day",
    dueDate: "2027-06-18",
    reviewer: null,
  }),
  // A meeting the Clerk has scheduled while its card is still locked, and one that is open.
  sampleTask({
    id: "t-meeting-locked",
    kind: "meeting",
    title: "Coordination meeting",
    why: "Special events meet with the City Clerk and Public Works & Safety before the day",
    reviewer: "clerk",
    status: "locked",
    unlocksOn: "permitted",
    dueDate: "2027-06-21",
    payload: { scheduledFor: "2027-06-21" },
  }),
  sampleTask({
    id: "t-meeting-open",
    kind: "meeting",
    title: "Site walkthrough",
    why: "Public Works & Safety walks the site with you before the event",
    reviewer: "pws",
    dueDate: "2027-07-02",
    payload: { scheduledFor: "2027-07-02" },
  }),
  // Sent back by the reviewer, with the reason.
  sampleTask({
    id: "t-sent-back",
    title: "Health permit: Rolling Dumpling Co.",
    why: "Each food vendor needs a current health permit",
    reviewer: "hl",
    status: "changes_requested",
    dueDate: "2027-05-07",
    payload: { rejectedReason: "This permit expired in March. Please upload the current one." },
    history: [
      { at: "2027-04-27T09:10", actor: "applicant", status: "submitted" },
      { at: "2027-04-30T10:00", actor: "hl", status: "changes_requested" },
    ],
  }),
  // Added by an amendment to a permitted event.
  sampleTask({
    id: "t-amendment",
    kind: "form",
    title: "Sound details",
    why: "Because you added amplified sound",
    reviewer: "pws",
    dueDate: "2027-05-10",
    tags: ["amendment"],
  }),
];

/** What each locked sample waits for: the card catalogue's own hints. */
const SAMPLE_UNLOCK_HINTS: Record<string, string> = {
  "t-locked": "Unlocks when your quote is ready.",
  "t-locked-dated": "For the day of your event",
  "t-meeting-locked": "Unlocks when your permit is issued",
};

const SAMPLE_FEE_LINES: FeeLine[] = [
  { id: "f1", dept: "clerk", label: "Application fee", qty: 1, unit: "flat", unitPrice: 250, estimate: 250, actual: 250, kind: "fee" },
  { id: "f2", dept: "pws", label: "Police", qty: 8, unit: "officer-hour", unitPrice: 85, estimate: 3400, actual: 3570, kind: "fee" },
  { id: "f3", dept: "pws", label: "Barricades", qty: 40, unit: "each", unitPrice: 15, estimate: 600, actual: null, kind: "fee" },
  { id: "f4", dept: "hl", label: "Food or vendor permit", qty: 0, unit: "each", unitPrice: 75, estimate: 0, actual: 0, kind: "fee" },
  { id: "d1", dept: "clerk", label: "Refundable cleanup deposit", qty: 1, unit: "flat", unitPrice: 1000, estimate: 1000, actual: null, kind: "deposit" },
];

const SAMPLE_CONDITIONS: Condition[] = [
  { id: "c1", dept: "pws", text: "Sound ends at 9 pm; speakers face away from the residences on Elm Street.", mergedByClerk: true, acceptedByApplicant: true },
  { id: "c2", dept: "pws", text: "No more than 85 dB measured at 50 feet.", mergedByClerk: true, acceptedByApplicant: false },
  { id: "c3", dept: "hl", text: "Vendor list confirmed at least 48 hours ahead of the event.", mergedByClerk: false, acceptedByApplicant: false },
];

const SAMPLE_ACTIVITY: Activity[] = [
  { at: "2027-04-16T09:10", actor: "applicant", text: "Started a draft." },
  { at: "2027-04-16T09:45", actor: "applicant", text: "Submitted the application." },
  { at: "2027-04-19T11:00", actor: "clerk", text: "Accepted as complete; date held until May 14." },
  { at: "2027-04-19T11:05", actor: "system", text: "Routed to Public Works & Safety and Health & Legal." },
  { at: "2027-04-21T14:20", actor: "hl", text: "Verified the insurance certificate." },
  { at: "2027-04-28T10:00", actor: "pws", text: "Approved with 3 conditions." },
  { at: "2027-04-30T08:30", actor: "neighbor", text: "Signed off." },
  { at: "2027-04-30T16:00", actor: "hl", text: "Requested the updated vendor list." },
];

const SAMPLE_WHO_IS_UP: PartyStatus[] = [
  {
    party: "applicant",
    status: "up_now",
    openTasks: [SAMPLE_TASKS[0]],
    oldestDue: "2027-04-20",
    daysHolding: 13,
    note: "",
    scope: LONG_ORG_NAME,
  },
  {
    party: "clerk",
    status: "not_involved",
    openTasks: [],
    oldestDue: null,
    daysHolding: 0,
    note: "Owns the case",
    scope: "Owns the case",
  },
  {
    party: "pws",
    status: "done_for_now",
    openTasks: [],
    oldestDue: null,
    daysHolding: 0,
    note: "Approved with conditions",
    scope: "Route, police, sound",
  },
  {
    party: "hl",
    status: "waiting",
    openTasks: [],
    oldestDue: null,
    daysHolding: 0,
    note: "Waiting on the applicant's response",
    scope: "Insurance, accessibility",
    // The task that waits: its title sits above the note.
    nextTask: sampleTask({ id: "t-review-hl", owner: "hl", kind: "review", title: "Review your sections", status: "locked", reviewer: null }),
  },
];

function KitSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="page-container flex flex-col gap-5 py-10">
      <div className="flex flex-col gap-1.5 border-b border-line-subtle pb-4">
        <h2 className="text-h4 font-bold text-fg">{title}</h2>
        {description ? <p className="max-w-2xl text-sm text-fg-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>{children}</div>;
}

function Swatch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-panel border border-line-subtle bg-surface-1 p-4">
      <span className="text-[11px] font-bold tracking-[.12em] text-fg-label uppercase">{label}</span>
      {children}
    </div>
  );
}

/**
 * The Phase 1 visual checkpoint: every Rime & Ink primitive and domain
 * component, in every variant and state, grouped under headings. The first
 * section shows the full .page-atmosphere treatment; everything after sits on
 * the quieter .app-ground, matching how the real app screens will use them.
 */
function KitScreen() {
  const [files, setFiles] = React.useState<FileRef[]>([]);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [segment, setSegment] = React.useState<"list" | "board" | "map">("board");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [acceptedIds, setAcceptedIds] = React.useState<string[]>(["c1"]);
  const [filterSearch, setFilterSearch] = React.useState("");
  const [filterTier, setFilterTier] = React.useState<Tier | "all">("all");
  const [activeChip, setActiveChip] = React.useState(false);

  function toggleAccept(id: string) {
    setAcceptedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <TooltipProvider>
      <div data-slot="kit-screen" className="min-h-screen app-ground">
        {/* ---- Atmosphere: the full landing-page chrome, shown once ---- */}
        <div className="page-atmosphere relative border-b border-line-subtle">
          <div className="page-container flex flex-col gap-4 py-16">
            <Eyebrow>Rime &amp; Ink</Eyebrow>
            <h1 className="max-w-2xl text-display font-extrabold text-fg">Design kit</h1>
            <p className="max-w-xl text-lead text-fg-secondary">
              Every primitive and domain component the Permitopolis prototype is built from, in every
              state. This section alone uses <code className="font-mono text-sm">.page-atmosphere</code>
              {" "}&mdash; the stacked gradients, the masked 56px grid and the grain. Everything below sits
              on the quieter <code className="font-mono text-sm">.app-ground</code>.
            </p>
            <Row>
              <Button className="anim-material-settle">
                <PlusIcon data-icon="inline-start" />
                Plan an event
              </Button>
              <Button variant="secondary" className="anim-idle-float">
                City staff
              </Button>
            </Row>
          </div>
        </div>

        {/* ---- Buttons ---- */}
        <KitSection
          id="buttons"
          title="Button"
          description="Primary, secondary (glass), dark, ghost, destructive and link, at 36/44/56px. Hover rises 2px; active compresses the shadow."
        >
          <div className="flex flex-col gap-4">
            <Row>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="dark">Dark</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link style</Button>
            </Row>
            <Row>
              <Button size="sm">36px small</Button>
              <Button size="default">44px default</Button>
              <Button size="lg">56px large</Button>
              <Button size="icon" aria-label="Settings">
                <SettingsIcon />
              </Button>
            </Row>
            <Row>
              <Button disabled>Disabled</Button>
              <Button variant="secondary" disabled>
                Disabled secondary
              </Button>
              <Button onClick={() => toast.success("Quote sent to Riverfront Running Club")}>
                Trigger a toast
              </Button>
            </Row>
          </div>
        </KitSection>

        {/* ---- Form controls ---- */}
        <KitSection id="forms" title="Form controls" description="Input, Textarea, Select, Checkbox, Switch, Radio, Field, Segmented control, File drop.">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Field label="Event name" hint="Shown on the applicant's board and the permit.">
                <Input placeholder="Jazz in the Plaza" />
              </Field>
              <Field label="Description" error="Tell us a little about the event.">
                <Textarea placeholder="A short description" />
              </Field>
              <Field label="Event type">
                <Select defaultValue="performance_rally">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="picnic_party">Picnic or party</SelectItem>
                    <SelectItem value="performance_rally">Performance or rally</SelectItem>
                    <SelectItem value="market_festival">Market or festival</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="kit-checkbox" defaultChecked />
                <Label htmlFor="kit-checkbox" className="normal-case">
                  Amplified sound
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="kit-switch" defaultChecked />
                <Label htmlFor="kit-switch" className="normal-case">
                  Hints on
                </Label>
              </div>
              <RadioGroup defaultValue="card" className="gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="card" id="kit-pay-card" />
                  <Label htmlFor="kit-pay-card" className="normal-case">
                    Pay by card
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="in_person" id="kit-pay-person" />
                  <Label htmlFor="kit-pay-person" className="normal-case">
                    Pay in person
                  </Label>
                </div>
              </RadioGroup>
              <SegmentedControl
                aria-label="Active permits view"
                value={segment}
                onChange={setSegment}
                options={[
                  { value: "list", label: "List" },
                  { value: "board", label: "Board" },
                  { value: "map", label: "Map" },
                ]}
              />
            </div>
          </div>
          <FileDrop
            sample={SAMPLE_FILE}
            onFiles={setFiles}
            hint="PDF, up to 10MB"
          />
          {files.length > 0 ? (
            <p className="text-xs text-fg-secondary">
              Kept: {files.map((f) => `${f.name} (${f.type})`).join(", ")}
            </p>
          ) : null}
        </KitSection>

        {/* ---- Tabs ---- */}
        <KitSection id="tabs" title="Tabs">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-3">
              Who&apos;s up, the stepper and the next-move sentence.
            </TabsContent>
            <TabsContent value="reviews" className="pt-3">
              Each department&apos;s review status and conditions.
            </TabsContent>
            <TabsContent value="documents" className="pt-3">
              Uploaded files and their verification state.
            </TabsContent>
          </Tabs>
          <Tabs defaultValue="line" className="mt-2">
            <TabsList variant="line">
              <TabsTrigger value="line">Line variant</TabsTrigger>
              <TabsTrigger value="second">Second tab</TabsTrigger>
            </TabsList>
            <TabsContent value="line" className="pt-3">
              The underline variant, used on the case-detail tab row.
            </TabsContent>
            <TabsContent value="second" className="pt-3">
              Second tab content.
            </TabsContent>
          </Tabs>
        </KitSection>

        {/* ---- Overlays ---- */}
        <KitSection id="overlays" title="Dialog, sheet, dropdown, popover, tooltip, command" description="HUD panels over a frosted backdrop.">
          <Row>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset the demo?</DialogTitle>
                  <DialogDescription>This restores the seed exactly as it was on Mon, May 3, 2027.</DialogDescription>
                </DialogHeader>
                <DialogFooter showCloseButton>
                  <Button variant="destructive">Reset</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">Open sheet (right / bottom &lt;640px)</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Health permit</SheetTitle>
                  <SheetDescription>Upload Rolling Dumpling Co.&apos;s permit.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 px-5 text-sm text-fg-secondary">Task detail goes here.</div>
                <SheetFooter>
                  <Button>Mark done</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">
                  Demo menu
                  <SettingsIcon data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Demo</DropdownMenuLabel>
                <DropdownMenuItem>Reset seed</DropdownMenuItem>
                <DropdownMenuItem>Set demo date&hellip;</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <TrashIcon />
                  Clear local state
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost">
                  <FileQuestionIcon data-icon="inline-start" />
                  Popover
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <p>Insurance must name the City of Permitopolis as additionally insured.</p>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications">
                  <BellIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Notifications <Kbd>N</Kbd>
              </TooltipContent>
            </Tooltip>

            <Button variant="secondary" onClick={() => setCommandOpen(true)}>
              <SearchIcon data-icon="inline-start" />
              Command palette
              <Kbd className="ml-1">⌘K</Kbd>
            </Button>
          </Row>

          <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
            <Command>
              <CommandInput placeholder="Jump to a case, role or scenario..." />
              <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Scenarios">
                  <CommandItem>
                    S3 &middot; Jazz in the Plaza
                    <CommandShortcut>S3</CommandShortcut>
                  </CommandItem>
                  <CommandItem>
                    S5 &middot; Riverfront Summer 5K
                    <CommandShortcut>S5</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </CommandDialog>
        </KitSection>

        {/* ---- Accordion ---- */}
        <KitSection id="accordion" title="Accordion">
          <Panel variant="plain" className="px-4">
            <Accordion type="single" collapsible>
              <AccordionItem value="a">
                <AccordionTrigger>Do I need insurance?</AccordionTrigger>
                <AccordionContent>Most Reviewed and Special events do. Instant bookings don&apos;t.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>How far ahead should I apply?</AccordionTrigger>
                <AccordionContent>10, 30 or 60 days, depending on tier.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </Panel>
        </KitSection>

        {/* ---- Table ---- */}
        <KitSection id="table" title="Table" description="Dense rows, sticky uppercase header, mono numeric cells.">
          <Panel variant="plain" className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell numeric>PMT-27-0118</TableCell>
                  <TableCell>Jazz in the Plaza</TableCell>
                  <TableCell numeric>Fri, Jun 18</TableCell>
                  <TableCell numeric>$715</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell numeric>PMT-27-0097</TableCell>
                  <TableCell>Riverfront Summer 5K</TableCell>
                  <TableCell numeric>Sun, Jul 11</TableCell>
                  <TableCell numeric>$6,530</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Panel>
        </KitSection>

        {/* ---- Feedback and content primitives ---- */}
        <KitSection id="feedback" title="Badge, chip, eyebrow, kbd, banner, callout, empty state, skeleton, stat">
          <Row>
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="outline">Outline</Badge>
          </Row>
          <Row>
            <Chip>
              <ChipDot className="text-fg-tertiary" />{/* guard-allow-tertiary: a dot, not text */}
              Neutral chip
            </Chip>
            <Chip variant="success">
              <ChipDot />
              Approved
            </Chip>
            <Chip variant="warning">
              <ChipDot />
              Needs info
            </Chip>
            <Eyebrow>Section label</Eyebrow>
            <Kbd>Esc</Kbd>
            <Kbd>⌘K</Kbd>
          </Row>
          <div className="flex flex-col gap-3">
            <Banner variant="info">Insurance must name the City as additionally insured.</Banner>
            <Banner variant="success">Public Works &amp; Safety approved with 3 conditions.</Banner>
            <Banner variant="warning">The date hold expires tomorrow.</Banner>
            <Banner variant="danger">This application was denied: street closure denied by Public Safety.</Banner>
            <Callout>Try it: open the Demo menu and jump to scenario S3.</Callout>
          </div>
          <Row>
            <EmptyState icon={InboxIcon} title="Nothing in your queue" text="Everything is waiting on someone else right now." />
            <EmptyState
              icon={SearchIcon}
              title="No cases match"
              text="Try clearing filters."
              action={<Button variant="secondary">Clear filters</Button>}
            />
          </Row>
          <Row>
            <Stat label="Open cases" value="38" />
            <Stat label="Due this week" value="6" />
            <Stat label="Overdue" value="2" />
          </Row>
          <Row>
            <Skeleton className="h-9 w-40" />
            <Skeleton className="size-9 rounded-full" />
          </Row>
        </KitSection>

        {/* ---- Panel, scroll area, separator ---- */}
        <KitSection id="surfaces" title="Panel, scroll area, separator">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Panel variant="frosted" className="p-4 text-sm">Frosted</Panel>
            <Panel variant="hud" className="p-4 text-sm">HUD</Panel>
            <Panel variant="night" className="p-4 text-sm">Night</Panel>
            <Panel variant="plain" className="p-4 text-sm">Plain (rows &amp; cards)</Panel>
            <Panel variant="soft" className="p-4 text-sm">Soft (future / dashed)</Panel>
          </div>
          <Panel variant="plain" className="p-2">
            <ScrollArea className="h-32 w-full">
              <div className="flex flex-col gap-2 p-2">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-fg-secondary">
                    <PaletteIcon className="size-3.5" aria-hidden="true" /> Row {i + 1}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Panel>
          <Separator />
        </KitSection>

        {/* ---- Motion ---- */}
        <KitSection id="motion" title="Motion" description="Material settle, idle float, surface sweep, breathing selection, caret blink.">
          <Row>
            <Panel variant="frosted" className="anim-material-settle p-4 text-sm">Material settle</Panel>
            <Panel variant="frosted" className="anim-idle-float p-4 text-sm">Idle float</Panel>
            <Panel variant="frosted" className="anim-surface-sweep p-4 text-sm">Surface sweep</Panel>
            <Panel variant="frosted" className="anim-breathing-selection p-4 text-sm">Breathing selection</Panel>
            <span className="anim-caret-blink font-mono text-lg text-fg">|</span>
          </Row>
        </KitSection>

        {/* ---- Domain: tier, party, state ---- */}
        <KitSection id="domain-badges" title="Domain: tier, party and state">
          <Row>
            {TIERS.map((tier) => (
              <TierBadge key={tier} tier={tier} />
            ))}
          </Row>
          <Row>
            {PARTIES.map((party) => (
              <PartyChip key={party} party={party} />
            ))}
          </Row>
          <Row>
            {PARTIES.map((party) => (
              <PartyAvatar key={party} party={party} />
            ))}
            {PARTIES.map((party) => (
              <PartyAvatar key={`lg-${party}`} party={party} size="lg" />
            ))}
          </Row>
          <Row>
            <WaitingOnChips items={[{ party: "applicant", days: 4 }, { party: "hl", days: 1 }]} />
            <WaitingOnChips items={[]} />
          </Row>
          <Row>
            {CASE_STATES.map((state) => (
              <StateChip key={state} state={state} />
            ))}
            {ENDINGS.map((ending) => (
              <StateChip key={ending} state="in_review" ending={ending} />
            ))}
          </Row>
        </KitSection>

        {/* ---- Domain: state stepper ---- */}
        <KitSection id="domain-stepper" title="Domain: StateStepper">
          <div className="flex flex-col gap-8">
            <Panel variant="plain" className="p-5">
              <StateStepper state="in_review" />
            </Panel>
            <Panel variant="plain" className="p-5">
              <StateStepper state="needs_info" />
            </Panel>
            <Panel variant="plain" className="p-5">
              <StateStepper state="in_review" ending="denied" />
            </Panel>
            <Panel variant="plain" className="p-4">
              <p className="mb-3 text-xs text-fg-label uppercase">Compact (card)</p>
              <StateStepper state="permitted" compact />
            </Panel>
          </div>
        </KitSection>

        {/* ---- Domain: review status, due date, clock, hold ---- */}
        <KitSection id="domain-review" title="Domain: review status, due date, review clock, hold status">
          <Row>
            {DEPTS.map((dept) =>
              REVIEW_STATUSES.map((status) => (
                <ReviewStatusDot key={`${dept}-${status}`} dept={dept} status={status} />
              ))
            )}
          </Row>
          <Row>
            <DueDate date="2027-05-07" today={DEMO_TODAY} />
            <DueDate date="2027-04-20" today={DEMO_TODAY} />
            <DueDate date="2027-05-03" today={DEMO_TODAY} relativeOnly />
          </Row>
          <Row>
            <ReviewClock dayCount={9} allowedDays={21} />
            <ReviewClock dayCount={9} allowedDays={21} paused pausedDays={2} />
            <ReviewClock dayCount={24} allowedDays={21} />
          </Row>
          <Row>
            <HoldStatus hold={{ status: "held", placedOn: "2027-04-30", expiresOn: "2027-05-14" }} />
            <HoldStatus hold={{ status: "none", placedOn: null, expiresOn: null }} />
            <HoldStatus hold={{ status: "expired", placedOn: "2027-04-01", expiresOn: "2027-04-15" }} />
            <HoldStatus hold={{ status: "released", placedOn: "2027-04-01", expiresOn: "2027-04-15" }} />
          </Row>
        </KitSection>

        {/* ---- Domain: mono (id, date, money) and icon maps ---- */}
        <KitSection id="domain-mono" title="Domain: CaseId, DateText, Money, and the icon maps">
          <Row>
            <CaseId id="PMT-27-0118" />
            <DateText date="2027-06-18" />
            <Money amount={715} />
            <Money amount={-62.5} signColor />
          </Row>
          <Row>
            {Object.entries(PARTY_ICON).map(([party, Icon]) => (
              <Swatch key={party} label={PARTY_LABEL[party as Party]}>
                <Icon className="size-5 text-fg-label" aria-hidden="true" />
              </Swatch>
            ))}
          </Row>
          <Row>
            {Object.entries(TIER_ICON).map(([tier, Icon]) => (
              <Swatch key={tier} label={tier}>
                <Icon className="size-5 text-fg-label" aria-hidden="true" />
              </Swatch>
            ))}
          </Row>
          <Row>
            {TASK_KINDS.map((kind) => {
              const Icon = TASK_KIND_ICON[kind];
              return (
                <Swatch key={kind} label={kind}>
                  <Icon className="size-5 text-fg-label" aria-hidden="true" />
                </Swatch>
              );
            })}
          </Row>
          <Row>
            {CASE_STATES.map((state) => {
              const Icon = CASE_STATE_ICON[state];
              return (
                <Swatch key={state} label={state}>
                  <Icon className="size-5 text-fg-label" aria-hidden="true" />
                </Swatch>
              );
            })}
            {ENDINGS.map((ending) => {
              const Icon = ENDING_ICON[ending];
              return (
                <Swatch key={ending} label={ending}>
                  <Icon className="size-5 text-fg-label" aria-hidden="true" />
                </Swatch>
              );
            })}
          </Row>
        </KitSection>

        {/* ---- Shared UI: page header, section, key-value list, confirm dialog ---- */}
        <KitSection
          id="ui-blocks-1"
          title="Shared UI: page header, section, key-value list, confirm dialog"
          description="PageHeader, Section, KeyValueList and the window.confirm replacement. A 101-character event name and missing fields are shown here (Part 3 stress rows)."
        >
          <Panel variant="plain" className="p-4">
            <PageHeader
              eyebrow="Case"
              title={LONG_EVENT_NAME}
              description="A long event name wraps rather than overflowing; the back link and actions sit above and beside it."
              backLabel="Back to cases"
              onBack={() => toast("Back to cases")}
              actions={<Button size="sm">Issue permit</Button>}
            />
          </Panel>
          <Section title="Documents" description="Uploaded files and their verification state." actions={<Button variant="ghost" size="sm">Upload</Button>}>
            <p className="text-sm text-fg-secondary">Section body goes here.</p>
          </Section>
          <KeyValueList
            columns={2}
            items={[
              { label: "Organization", value: LONG_ORG_NAME },
              { label: "Attendance", value: "1,200" },
              { label: "Description", value: null },
              { label: "Setup time", value: undefined },
            ]}
          />
          <Row>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              Reset the demo
            </Button>
          </Row>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Reset the demo?"
            body="This restores the seed exactly as it was on Mon, May 3, 2027."
            confirmLabel="Reset"
            destructive
            onConfirm={() => toast.success("Demo reset")}
          />
        </KitSection>

        {/* ---- Shared UI: wizard stepper, filter bar, count badge, toolbar ---- */}
        <KitSection
          id="ui-blocks-2"
          title="Shared UI: wizard stepper, filter bar, count badge, toolbar"
          description="The applicant wizard's 1-to-5 stepper and the filter row every list view shares."
        >
          <WizardStepper
            steps={[{ label: "What" }, { label: "Where" }, { label: "When" }, { label: "Size" }, { label: "Plan" }]}
            current={2}
            onStepSelect={(index) => toast(`Edit step ${index + 1}`)}
          />
          <FilterBar
            selectLabel="Tier"
            selectValue={filterTier}
            selectOptions={[
              { value: "all", label: "All tiers" },
              { value: "instant", label: "Instant" },
              { value: "reviewed", label: "Reviewed" },
              { value: "special", label: "Special event" },
            ]}
            onSelectChange={(value) => setFilterTier(value as Tier | "all")}
            searchValue={filterSearch}
            onSearchChange={setFilterSearch}
            searchPlaceholder="Search cases"
            searchShortcut="/"
            resultCount={6}
            resultNoun="case"
            onClear={() => {
              setFilterSearch("");
              setFilterTier("all");
              setActiveChip(false);
            }}
          >
            <FilterChip active={activeChip} onClick={() => setActiveChip((v) => !v)}>
              Involves me
            </FilterChip>
          </FilterBar>
          <Row>
            <CountBadge count={6} />
            <CountBadge count={2} variant="accent" />
            <CountBadge count={1} variant="danger" />
          </Row>
          <Toolbar aria-label="Case actions">
            <Button variant="secondary" size="sm">
              Export
            </Button>
            <Button variant="ghost" size="sm">
              Print
            </Button>
          </Toolbar>
        </KitSection>

        {/* ---- Shared UI: progress, inline alert, sticky aside, truncate, copy button ---- */}
        <KitSection
          id="ui-blocks-3"
          title="Shared UI: progress, inline alert, sticky aside, truncate, copy button"
        >
          <Progress value={9} max={12} label="9 of 12 neighbors" />
          <div className="flex flex-col gap-2">
            <InlineAlert variant="info">Insurance must name the City as additionally insured.</InlineAlert>
            <InlineAlert variant="success">Verified.</InlineAlert>
            <InlineAlert variant="warning">The date hold expires tomorrow.</InlineAlert>
            <InlineAlert variant="danger">Rejected: the certificate is missing the City as additional insured.</InlineAlert>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_260px]">
            <Panel variant="plain" className="p-4 text-sm text-fg-secondary">
              Page content scrolls here while the aside on the right stays in view.
            </Panel>
            <StickyAside topOffset="1rem">
              <p className="text-sm font-semibold text-fg">Your actions</p>
              <p className="mt-1 text-xs text-fg-secondary">City Clerk · Quote sent</p>
            </StickyAside>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="max-w-64 rounded-panel border border-line-subtle bg-surface-1 p-3">
              <p className="mb-1 text-xs text-fg-label uppercase">Single line</p>
              <Truncate text={LONG_EVENT_NAME} className="text-sm text-fg" />
            </div>
            <div className="max-w-64 rounded-panel border border-line-subtle bg-surface-1 p-3">
              <p className="mb-1 text-xs text-fg-label uppercase">Two lines</p>
              <Truncate text={LONG_EVENT_NAME} lines={2} className="text-sm text-fg" />
            </div>
          </div>
          <Row>
            <CopyButton value="PMT-27-0118" label="Copy case ID" />
          </Row>
        </KitSection>

        {/* ---- Domain: persona avatar, task kind label, availability badge, ending banner ---- */}
        <KitSection
          id="domain-identity"
          title="Domain: persona avatar, task kind label, availability badge, ending banner"
          description="Endings (Withdrawn, Denied, Cancelled, Hold expired), each with its reason — the Part 3 'ended case' stress row."
        >
          <Row>
            <PersonaAvatar name="Maya Chen" />
            <PersonaAvatar name="Riverfront Running Club" />
            <PersonaAvatar name={LONG_ORG_NAME} />
          </Row>
          <Row>
            {TASK_KINDS.map((kind) => (
              <TaskKindLabel key={kind} kind={kind} />
            ))}
          </Row>
          <Row>
            <AvailabilityBadge availability={{ status: "open" }} />
            <AvailabilityBadge availability={{ status: "impacted", reason: "Impacted 6 to 11:30 am" }} />
            <AvailabilityBadge availability={{ status: "booked" }} />
            <AvailabilityBadge availability={{ status: "blackout", reason: "Citywide maintenance" }} />
          </Row>
          <div className="flex flex-col gap-2">
            {ENDINGS.map((ending) => (
              <EndingBanner
                key={ending}
                ending={ending}
                reason={
                  ending === "denied"
                    ? "Street closure denied by Public Safety."
                    : ending === "hold_expired"
                      ? "The date hold expired before payment was received."
                      : ending === "cancelled"
                        ? "Cancelled by the applicant after the permit issued."
                        : "Withdrawn by the applicant before review."
                }
              />
            ))}
          </div>
        </KitSection>

        {/* ---- Domain: case row pieces ---- */}
        <KitSection id="domain-case-row" title="Domain: EventTitle, LeadTimeRisk, DeptStatusDots" description="Dense-list building blocks for the cases pipeline and My queue.">
          <div className="max-w-xs rounded-control border border-line-subtle bg-surface-1 p-2">
            <EventTitle name={LONG_EVENT_NAME} applicantName={LONG_ORG_NAME} />
          </div>
          <Row>
            <LeadTimeRisk risk="at_risk" />
            <span className="text-xs text-fg-secondary">(risk=&quot;ok&quot; renders nothing, shown here as empty space) </span>
            <LeadTimeRisk risk="ok" />
          </Row>
          <Row>
            <DeptStatusDots
              items={[
                { dept: "clerk", status: "pending" },
                { dept: "pws", status: "approved_with_conditions" },
                { dept: "hl", status: "needs_info" },
              ]}
            />
            <span className="text-xs text-fg-secondary">Focus or hover the row for the words.</span>
          </Row>
          {/* Every status has a glyph of its own beside the department's icon, so none differs by tint alone. */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {(["not_routed", "pending", "approved", "approved_with_conditions", "needs_info", "denied"] as const).map((status) => (
              <div key={status} className="flex items-center gap-2">
                <DeptStatusDots items={[{ dept: "pws", status }]} />
                <span className="text-xs text-fg-secondary">{REVIEW_STATUS_TEXT[status]}</span>
              </div>
            ))}
          </div>
        </KitSection>

        {/* ---- Domain: CaseHeader ---- */}
        <KitSection id="domain-case-header" title="Domain: CaseHeader" description="The header strip from both wireframes, active and ended.">
          <div className="flex flex-col gap-4">
            <CaseHeader
              name="Jazz in the Plaza"
              tier="reviewed"
              caseId="PMT-27-0118"
              applicantName="Downtown Arts Collective"
              eventDate="2027-06-18"
              today={DEMO_TODAY}
              state="in_review"
              hold={{ status: "none", placedOn: null, expiresOn: null }}
              reviewClock={{ dayCount: 9, allowedDays: 21, paused: true, pausedDays: 2 }}
              actions={<Button size="sm">Send quote</Button>}
            />
            <CaseHeader
              name={LONG_EVENT_NAME}
              tier="special"
              caseId="PMT-27-0099"
              applicantName={LONG_ORG_NAME}
              eventDate="2027-04-24"
              today={DEMO_TODAY}
              state="in_review"
              ending="denied"
              hold={{ status: "released", placedOn: "2027-03-01", expiresOn: "2027-03-15" }}
            />
          </div>
        </KitSection>

        {/* ---- Domain: ActivityTimeline ---- */}
        <KitSection id="domain-activity" title="Domain: ActivityTimeline" description="A collapsed log (latest 3, Show all) next to the full log.">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold tracking-[.12em] text-fg-label uppercase">Collapsed</p>
              <ActivityTimeline items={SAMPLE_ACTIVITY} collapsedCount={3} />
            </div>
            <div>
              <p className="mb-2 text-xs font-bold tracking-[.12em] text-fg-label uppercase">Full, one entry</p>
              <ActivityTimeline items={SAMPLE_ACTIVITY.slice(0, 1)} />
            </div>
          </div>
        </KitSection>

        {/* ---- Domain: FeeTable ---- */}
        <KitSection id="domain-fees" title="Domain: FeeTable" description="The quote's fee table, and closeout's Actual/Difference columns (including a $0 line and a figure still unlogged).">
          <div className="flex flex-col gap-6">
            <FeeTable lines={SAMPLE_FEE_LINES} />
            <FeeTable lines={SAMPLE_FEE_LINES} showActual />
          </div>
        </KitSection>

        {/* ---- Domain: ConditionList ---- */}
        <KitSection id="domain-conditions" title="Domain: ConditionList" description="Read-only (the permit) and editable (accept and sign) modes.">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ConditionList conditions={SAMPLE_CONDITIONS} />
            <ConditionList conditions={SAMPLE_CONDITIONS} editable acceptedIds={acceptedIds} onToggleAccept={toggleAccept} />
          </div>
        </KitSection>

        {/* ---- Domain: WhoIsUp ---- */}
        <KitSection id="domain-who-is-up" title="Domain: WhoIsUp" description="docs/spec/img/wireframe-case-s5.png, with an overdue applicant task, a long organization name under Applicant, and a waiting row that names the task it waits to do. Rows that are up come first.">
          <WhoIsUp
            items={SAMPLE_WHO_IS_UP}
            today={DEMO_TODAY}
            applicantName={LONG_ORG_NAME}
            nextMove="Next: the applicant responds to Health & Legal's request, then Health & Legal re-reviews."
            onSelectTask={(taskId) => toast(`Open ${taskId}`)}
          />
        </KitSection>

        {/* ---- Domain: TaskCard ---- */}
        <KitSection id="domain-task-card" title="Domain: TaskCard, StackedTaskCard" description="Locked (dashed), a pinned and overdue request, sign-off progress, a payment amount, done with and without its date, a locked card with its day, a scheduled meeting locked and open, changes requested with the reason, an amendment card, and the stacked-card variant.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_TASKS.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                today={DEMO_TODAY}
                unlockHint={SAMPLE_UNLOCK_HINTS[task.id]}
                onSelect={() => toast(`Open ${task.title}`)}
              />
            ))}
            <StackedTaskCard title="Vendor health permits" done={25} total={25} onSelect={() => toast("Open vendor permits")} />
          </div>
        </KitSection>

        {/* ---- Page skeleton ---- */}
        <KitSection id="page-skeleton" title="Page skeleton" description="Shown until useHydrated() is true.">
          <Panel variant="plain" className="p-0">
            <PageSkeleton />
          </Panel>
        </KitSection>

        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export { KitScreen };
