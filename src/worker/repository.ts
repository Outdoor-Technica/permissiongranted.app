import type { Decision, PublicRequest, RequestStatus } from "../shared/contracts";

export interface RequestRow {
  id: string;
  public_id: string;
  management_token_hash: string;
  management_token_ciphertext: string;
  approve_token_hash: string;
  approve_token_ciphertext: string;
  decline_token_hash: string;
  decline_token_ciphertext: string;
  report_token_hash: string;
  report_token_ciphertext: string;
  sender_email_ciphertext: string;
  sender_email_hmac: string;
  recipient_email_ciphertext: string;
  recipient_email_hmac: string;
  sender_verified_at: number | null;
  requester_name: string;
  recipient_name: string;
  request_title: string;
  justification: string;
  status: RequestStatus;
  recipient_email_status: "sending" | "sent" | "failed" | null;
  recipient_email_message_id: string | null;
  recipient_email_error_code: string | null;
  recipient_email_sent_at: number | null;
  sender_result_email_status: "sending" | "sent" | "failed" | null;
  sender_result_email_message_id: string | null;
  sender_result_email_error_code: string | null;
  sender_result_email_sent_at: number | null;
  created_at: number;
  expires_at: number;
  decided_at: number | null;
  disabled_at: number | null;
  terms_version: string | null;
  privacy_version: string | null;
  terms_accepted_at: number | null;
}

export interface InsertRequest {
  id: string;
  publicId: string;
  managementTokenHash: string;
  managementTokenCiphertext: string;
  approveTokenHash: string;
  approveTokenCiphertext: string;
  declineTokenHash: string;
  declineTokenCiphertext: string;
  reportTokenHash: string;
  reportTokenCiphertext: string;
  senderEmailCiphertext: string;
  senderEmailHmac: string;
  recipientEmailCiphertext: string;
  recipientEmailHmac: string;
  requesterName: string;
  recipientName: string;
  requestTitle: string;
  justification: string;
  termsVersion: string;
  privacyVersion: string;
  termsAcceptedAt: number;
  createdAt: number;
  expiresAt: number;
}

const SELECT_COLUMNS = `
  id, public_id, management_token_hash, management_token_ciphertext,
  approve_token_hash, approve_token_ciphertext, decline_token_hash,
  decline_token_ciphertext, report_token_hash, report_token_ciphertext,
  sender_email_ciphertext, sender_email_hmac,
  recipient_email_ciphertext, recipient_email_hmac, sender_verified_at,
  requester_name, recipient_name, request_title, justification, status,
  recipient_email_status, recipient_email_message_id, recipient_email_error_code,
  recipient_email_sent_at, sender_result_email_status,
  sender_result_email_message_id, sender_result_email_error_code,
  sender_result_email_sent_at, created_at, expires_at, decided_at, disabled_at,
  terms_version, privacy_version, terms_accepted_at
`;

export function toPublicRequest(row: RequestRow): PublicRequest {
  return {
    publicId: row.public_id,
    requesterName: row.requester_name,
    recipientName: row.recipient_name,
    requestTitle: row.request_title,
    justification: row.justification,
    status: row.status,
    expiresAt: row.expires_at,
    decidedAt: row.decided_at,
  };
}

export async function insertRequest(db: D1Database, input: InsertRequest): Promise<void> {
  await db
    .prepare(
      `INSERT INTO requests (
        id, public_id, management_token_hash, management_token_ciphertext,
        approve_token_hash, approve_token_ciphertext, decline_token_hash,
        decline_token_ciphertext, report_token_hash, report_token_ciphertext,
        sender_email_ciphertext, sender_email_hmac, recipient_email_ciphertext,
        recipient_email_hmac, requester_name, recipient_name, request_title,
        justification, status, created_at, expires_at, terms_version,
        privacy_version, terms_accepted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.publicId,
      input.managementTokenHash,
      input.managementTokenCiphertext,
      input.approveTokenHash,
      input.approveTokenCiphertext,
      input.declineTokenHash,
      input.declineTokenCiphertext,
      input.reportTokenHash,
      input.reportTokenCiphertext,
      input.senderEmailCiphertext,
      input.senderEmailHmac,
      input.recipientEmailCiphertext,
      input.recipientEmailHmac,
      input.requesterName,
      input.recipientName,
      input.requestTitle,
      input.justification,
      "awaiting_sender_verification",
      input.createdAt,
      input.expiresAt,
      input.termsVersion,
      input.privacyVersion,
      input.termsAcceptedAt,
    )
    .run();
}

export async function getByManagementHash(
  db: D1Database,
  tokenHash: string,
): Promise<RequestRow | null> {
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM requests WHERE management_token_hash = ?`)
    .bind(tokenHash)
    .first<RequestRow>();
}

export async function getByActionHash(
  db: D1Database,
  tokenHash: string,
): Promise<{ row: RequestRow; decision: Decision } | null> {
  const row = await db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM requests
       WHERE approve_token_hash = ? OR decline_token_hash = ?`,
    )
    .bind(tokenHash, tokenHash)
    .first<RequestRow>();

  if (row === null) {
    return null;
  }
  return {
    row,
    decision: row.approve_token_hash === tokenHash ? "approved" : "declined",
  };
}

export async function getByReportHash(
  db: D1Database,
  tokenHash: string,
): Promise<RequestRow | null> {
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM requests WHERE report_token_hash = ?`)
    .bind(tokenHash)
    .first<RequestRow>();
}

export async function requestCountForEmail(
  db: D1Database,
  column: "sender_email_hmac" | "recipient_email_hmac",
  emailHmac: string,
  since: number,
): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS count FROM requests WHERE ${column} = ? AND created_at >= ?`)
    .bind(emailHmac, since)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function beginRecipientDelivery(
  db: D1Database,
  requestId: string,
  now: number,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE requests
       SET status = 'sending_recipient_email',
           sender_verified_at = COALESCE(sender_verified_at, ?),
           recipient_email_status = 'sending',
           recipient_email_error_code = NULL
       WHERE id = ?
         AND status IN ('awaiting_sender_verification', 'recipient_email_failed')`,
    )
    .bind(now, requestId)
    .run();
  return (result.meta.changes ?? 0) === 1;
}

export async function completeRecipientDelivery(
  db: D1Database,
  requestId: string,
  messageId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE requests
       SET status = 'pending',
           recipient_email_status = 'sent',
           recipient_email_message_id = ?,
           recipient_email_sent_at = ?,
           recipient_email_error_code = NULL
       WHERE id = ? AND status = 'sending_recipient_email'`,
    )
    .bind(messageId, now, requestId)
    .run();
}

export async function failRecipientDelivery(
  db: D1Database,
  requestId: string,
  errorCode: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE requests
       SET status = 'recipient_email_failed',
           recipient_email_status = 'failed',
           recipient_email_error_code = ?
       WHERE id = ? AND status = 'sending_recipient_email'`,
    )
    .bind(errorCode, requestId)
    .run();
}

export async function recordDecision(
  db: D1Database,
  requestId: string,
  decision: Decision,
  now: number,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE requests
       SET status = ?,
           decided_at = ?,
           sender_result_email_status = 'sending',
           sender_result_email_error_code = NULL
       WHERE id = ? AND status = 'pending' AND expires_at > ?`,
    )
    .bind(decision, now, requestId, now)
    .run();
  return (result.meta.changes ?? 0) === 1;
}

export async function completeResultDelivery(
  db: D1Database,
  requestId: string,
  messageId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE requests
       SET sender_result_email_status = 'sent',
           sender_result_email_message_id = ?,
           sender_result_email_sent_at = ?,
           sender_result_email_error_code = NULL
       WHERE id = ?`,
    )
    .bind(messageId, now, requestId)
    .run();
}

export async function failResultDelivery(
  db: D1Database,
  requestId: string,
  errorCode: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE requests
       SET sender_result_email_status = 'failed',
           sender_result_email_error_code = ?
       WHERE id = ?`,
    )
    .bind(errorCode, requestId)
    .run();
}
