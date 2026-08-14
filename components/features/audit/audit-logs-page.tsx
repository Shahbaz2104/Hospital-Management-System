"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";

type AuditRow = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: string | null;
};

type AuditResponse = { items: AuditRow[]; meta: { page: number; total: number; totalPages: number } };

const PAGE_SIZE = 25;

export function AuditLogsPage() {
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => apiGet<AuditResponse>("/audit-logs", { page, pageSize: PAGE_SIZE }),
  });

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Every important action is recorded here"
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (data?.items.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No events yet
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.actor ?? "System"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.entity ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-xs text-muted-foreground">
                    {log.ipAddress}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(log.createdAt), "MMM d, yyyy h:mm:ss a")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(data?.meta.totalPages ?? 0) > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="px-4 text-sm text-muted-foreground">
                Page {data?.meta.page} of {data?.meta.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (data?.meta.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}