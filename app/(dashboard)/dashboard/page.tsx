import {
  BedDouble,
  CalendarClock,
  HeartPulse,
  Receipt,
  Stethoscope,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AnimatedText } from "@/components/motion/animated-text";
import { Reveal } from "@/components/motion/reveal";
import { Stagger } from "@/components/motion/stagger";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const stats = [
  {
    title: "Today's Patients",
    icon: Users,
    hint: "Check-ins so far",
  },
  {
    title: "Today's Appointments",
    icon: CalendarClock,
    hint: "Confirmed slots",
  },
  {
    title: "Doctors Available",
    icon: Stethoscope,
    hint: "On duty now",
  },
  {
    title: "Pending Lab Reports",
    icon: HeartPulse,
    hint: "Awaiting results",
  },
  {
    title: "Pending Bills",
    icon: Receipt,
    hint: "Unpaid invoices",
  },
  {
    title: "Available Beds",
    icon: BedDouble,
    hint: "Across all wards",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={<AnimatedText text="Dashboard" as="span" />}
        description="Hospital overview and today's activity"
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            data-stagger-item
            className="card-hover"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <CardDescription className="pt-1 text-xs">
                {stat.hint}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </Stagger>

      <div className="grid gap-4 lg:grid-cols-7">
        <Reveal className="lg:col-span-4">
          <Card className="h-full card-hover">
            <CardHeader>
              <CardTitle>Revenue Analytics</CardTitle>
              <CardDescription>Monthly revenue overview</CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </Reveal>
        <Reveal className="lg:col-span-3" delay={0.1}>
          <Card className="h-full card-hover">
            <CardHeader>
              <CardTitle>Recent Admissions</CardTitle>
              <CardDescription>Latest patient admissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}