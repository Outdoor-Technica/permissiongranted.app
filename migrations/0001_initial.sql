CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  management_token_hash TEXT NOT NULL UNIQUE,
  management_token_ciphertext TEXT NOT NULL,
  approve_token_hash TEXT NOT NULL UNIQUE,
  approve_token_ciphertext TEXT NOT NULL,
  decline_token_hash TEXT NOT NULL UNIQUE,
  decline_token_ciphertext TEXT NOT NULL,
  report_token_hash TEXT NOT NULL UNIQUE,
  report_token_ciphertext TEXT NOT NULL,
  sender_email_ciphertext TEXT NOT NULL,
  sender_email_hmac TEXT NOT NULL,
  recipient_email_ciphertext TEXT NOT NULL,
  recipient_email_hmac TEXT NOT NULL,
  sender_verified_at INTEGER,
  requester_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  request_title TEXT NOT NULL,
  justification TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'awaiting_sender_verification',
      'sending_recipient_email',
      'recipient_email_failed',
      'pending',
      'approved',
      'declined',
      'disabled'
    )
  ),
  recipient_email_status TEXT CHECK (
    recipient_email_status IN ('sending', 'sent', 'failed')
  ),
  recipient_email_message_id TEXT,
  recipient_email_error_code TEXT,
  recipient_email_sent_at INTEGER,
  sender_result_email_status TEXT CHECK (
    sender_result_email_status IN ('sending', 'sent', 'failed')
  ),
  sender_result_email_message_id TEXT,
  sender_result_email_error_code TEXT,
  sender_result_email_sent_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  decided_at INTEGER,
  disabled_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_requests_expires_at
  ON requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_requests_status_expires_at
  ON requests(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_requests_sender_email_hmac
  ON requests(sender_email_hmac);
CREATE INDEX IF NOT EXISTS idx_requests_recipient_email_hmac
  ON requests(recipient_email_hmac);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_previews (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('sender_verification', 'recipient_request', 'approval_certificate', 'decline_notice')
  ),
  recipient_masked TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);
