import type { ActionRequest, ApprovalTicket } from "@aether/contracts";
import { id, nowIso } from "@aether/contracts";

export class ApprovalDesk {
  private readonly tickets = new Map<string, ApprovalTicket>();

  create(request: ActionRequest, reason: string): ApprovalTicket {
    const ticket: ApprovalTicket = {
      id: id("apr"),
      taskId: request.taskId,
      request,
      reason,
      status: "pending",
      createdAt: nowIso(),
    };
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  get(id: string): ApprovalTicket | undefined {
    return this.tickets.get(id);
  }

  list(taskId?: string): ApprovalTicket[] {
    const all = [...this.tickets.values()];
    return taskId ? all.filter((ticket) => ticket.taskId === taskId) : all;
  }

  resolve(
    ticketId: string,
    status: "approved" | "denied",
    resolvedBy: string,
  ): ApprovalTicket {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error(`Unknown approval ${ticketId}`);
    }
    if (ticket.status !== "pending") {
      throw new Error(`Approval ${ticketId} is already ${ticket.status}`);
    }
    const updated: ApprovalTicket = {
      ...ticket,
      status,
      resolvedAt: nowIso(),
      resolvedBy,
    };
    this.tickets.set(ticketId, updated);
    return updated;
  }

  hydrate(tickets: ApprovalTicket[]): void {
    for (const ticket of tickets) {
      this.tickets.set(ticket.id, ticket);
    }
  }
}
