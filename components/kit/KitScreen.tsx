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

import {
  CASE_STATE_ICON,
  CaseId,
  DateText,
  DueDate,
  ENDING_ICON,
  HoldStatus,
  Money,
  PARTY_ICON,
  PartyAvatar,
  PartyChip,
  ReviewClock,
  ReviewStatusDot,
  StateChip,
  StateStepper,
  TASK_KIND_ICON,
  TIER_ICON,
  TierBadge,
  WaitingOnChips,
} from "@/components/domain"
import {
  DEPTS,
  ENDING_LABEL,
  PARTIES,
  PARTY_LABEL,
  STATE_LABEL,
  type CaseState,
  type Ending,
  type FileRef,
  type Party,
  type ReviewStatus,
  type TaskKind,
  type Tier,
} from "@/lib/types"

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

function Section({
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
        <Section
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
        </Section>

        {/* ---- Form controls ---- */}
        <Section id="forms" title="Form controls" description="Input, Textarea, Select, Checkbox, Switch, Radio, Field, Segmented control, File drop.">
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
        </Section>

        {/* ---- Tabs ---- */}
        <Section id="tabs" title="Tabs">
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
        </Section>

        {/* ---- Overlays ---- */}
        <Section id="overlays" title="Dialog, sheet, dropdown, popover, tooltip, command" description="HUD panels over a frosted backdrop.">
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
        </Section>

        {/* ---- Accordion ---- */}
        <Section id="accordion" title="Accordion">
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
        </Section>

        {/* ---- Table ---- */}
        <Section id="table" title="Table" description="Dense rows, sticky uppercase header, mono numeric cells.">
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
        </Section>

        {/* ---- Feedback and content primitives ---- */}
        <Section id="feedback" title="Badge, chip, eyebrow, kbd, banner, callout, empty state, skeleton, stat">
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
        </Section>

        {/* ---- Panel, scroll area, separator ---- */}
        <Section id="surfaces" title="Panel, scroll area, separator">
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
        </Section>

        {/* ---- Motion ---- */}
        <Section id="motion" title="Motion" description="Material settle, idle float, surface sweep, breathing selection, caret blink.">
          <Row>
            <Panel variant="frosted" className="anim-material-settle p-4 text-sm">Material settle</Panel>
            <Panel variant="frosted" className="anim-idle-float p-4 text-sm">Idle float</Panel>
            <Panel variant="frosted" className="anim-surface-sweep p-4 text-sm">Surface sweep</Panel>
            <Panel variant="frosted" className="anim-breathing-selection p-4 text-sm">Breathing selection</Panel>
            <span className="anim-caret-blink font-mono text-lg text-fg">|</span>
          </Row>
        </Section>

        {/* ---- Domain: tier, party, state ---- */}
        <Section id="domain-badges" title="Domain: tier, party and state">
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
        </Section>

        {/* ---- Domain: state stepper ---- */}
        <Section id="domain-stepper" title="Domain: StateStepper">
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
        </Section>

        {/* ---- Domain: review status, due date, clock, hold ---- */}
        <Section id="domain-review" title="Domain: review status, due date, review clock, hold status">
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
        </Section>

        {/* ---- Domain: mono (id, date, money) and icon maps ---- */}
        <Section id="domain-mono" title="Domain: CaseId, DateText, Money, and the icon maps">
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
        </Section>

        {/* ---- Page skeleton ---- */}
        <Section id="page-skeleton" title="Page skeleton" description="Shown until useHydrated() is true.">
          <Panel variant="plain" className="p-0">
            <PageSkeleton />
          </Panel>
        </Section>

        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export { KitScreen };
