export interface SessionIdentity {
  orgId: string;
  userId: string;
}

export interface SessionPayload {
  session: SessionIdentity;
  isDemo: boolean;
}
