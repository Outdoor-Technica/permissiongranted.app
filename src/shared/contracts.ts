export type Decision = "approved" | "declined";

export type RequestStatus =
  | "awaiting_sender_verification"
  | "sending_recipient_email"
  | "recipient_email_failed"
  | "pending"
  | Decision
  | "disabled";

export interface CreateRequestInput {
  requesterName: string;
  recipientName: string;
  senderEmail: string;
  recipientEmail: string;
  requestTitle: string;
  justification: string;
  turnstileToken: string;
  acceptableUseAccepted: boolean;
}

export interface PublicRequest {
  publicId: string;
  requesterName: string;
  recipientName: string;
  requestTitle: string;
  justification: string;
  status: RequestStatus;
  expiresAt: number;
  decidedAt: number | null;
}

export interface ConfirmationResponse {
  request: PublicRequest;
  confirmationProof: string;
  proposedDecision?: Decision;
  senderEmailMasked?: string;
  recipientEmailMasked?: string;
  recipientEmailStatus?: "sending" | "sent" | "failed" | null;
  senderResultEmailStatus?: "sending" | "sent" | "failed" | null;
}

export interface ApiError {
  error: string;
  code: string;
}
