export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

interface RequestEmailData {
  publicId: string;
  requesterName: string;
  recipientName: string;
  requestTitle: string;
  justification: string;
  expiresAt: number;
}

interface RecipientEmailLinks {
  approveUrl: string;
  declineUrl: string;
  reportUrl: string;
  safetyUrl: string;
  privacyUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(timestamp));
}

function formatDecisionDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
    timeZoneName: "short",
  })
    .format(new Date(timestamp))
    .toUpperCase();
}

function emailShell(preheader: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Permission Granted</title>
</head>
<body style="margin:0;padding:0;background:#eeece6;color:#1c2933;font-family:'IBM Plex Sans',Aptos,Segoe UI,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eeece6;">
    <tr>
      <td align="center" style="padding:30px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#fffdf7;border:1px solid #cfc7b8;">
          <tr>
            <td style="padding:36px 44px 20px;text-align:center;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:23px;letter-spacing:5px;font-weight:700;color:#1c2933;">
                <span style="display:inline-block;width:38px;height:38px;line-height:34px;margin-right:12px;border:3px solid #285c52;border-radius:50%;color:#285c52;font-family:Arial,sans-serif;font-size:24px;letter-spacing:0;vertical-align:middle;">✓</span>
                PERMISSION GRANTED
              </div>
            </td>
          </tr>
          ${body}
          <tr>
            <td style="padding:20px 44px 32px;text-align:center;color:#667078;font-size:12px;line-height:1.6;border-top:1px solid #cfc7b8;">
              Permission Granted · <a href="https://permissiongranted.app" style="color:#285c52;">permissiongranted.app</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function requestRows(data: RequestEmailData): string {
  const rows: Array<[string, string]> = [
    ["FROM", data.requesterName],
    ["REQUEST", data.requestTitle],
    ["REASON", data.justification],
    ["EXPIRES", formatDate(data.expiresAt)],
  ];

  return rows
    .map(
      ([label, value]) => `<tr>
        <td width="24%" style="padding:14px 16px;border-bottom:1px solid #cfc7b8;color:#667078;font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;letter-spacing:1.5px;vertical-align:top;">${label}</td>
        <td style="padding:14px 16px;border-bottom:1px solid #cfc7b8;border-left:1px solid #cfc7b8;color:#1c2933;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.45;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");
}

export function senderVerificationEmail(
  data: RequestEmailData,
  verifyUrl: string,
): EmailContent {
  const subject = "Confirm your Permission Granted request";
  const preheader = "Confirm your address before the request is sent.";
  const body = `
    <tr>
      <td style="padding:12px 44px 38px;">
        <div style="text-align:center;color:#667078;font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;letter-spacing:1.5px;">DRAFT REQUEST · ${escapeHtml(data.publicId)}</div>
        <h1 style="margin:18px 0 10px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.15;font-weight:500;">Confirm and send.</h1>
        <p style="margin:0 auto 26px;max-width:520px;text-align:center;color:#667078;font-size:15px;line-height:1.6;">Confirm your address and we’ll email this playful request to ${escapeHtml(data.recipientName)}.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #cfc7b8;">${requestRows(data)}</table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr><td align="center" style="padding:28px 0 18px;">
            <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:14px 26px;background:#285c52;color:#ffffff;text-decoration:none;font-weight:700;border:1px solid #285c52;">Confirm and send request</a>
          </td></tr>
        </table>
        <p style="margin:0;text-align:center;color:#667078;font-size:12px;line-height:1.6;">Opening the link does not send anything. You’ll confirm once more on permissiongranted.app.</p>
      </td>
    </tr>`;

  return {
    subject,
    html: emailShell(preheader, body),
    text: `${subject}

Request ${data.publicId}
From: ${data.requesterName}
To: ${data.recipientName}
Request: ${data.requestTitle}
Reason: ${data.justification}

Confirm and send:
${verifyUrl}

Opening the link does not send anything. You will confirm once more on permissiongranted.app.`,
  };
}

export function recipientRequestEmail(
  data: RequestEmailData,
  links: RecipientEmailLinks,
): EmailContent {
  const subject = `${data.requesterName} sent you a Permission Granted request`;
  const preheader = `Approve or decline a playful request from ${data.requesterName}.`;
  const body = `
    <tr>
      <td style="padding:12px 44px 32px;">
        <div style="text-align:center;color:#667078;font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;letter-spacing:1.5px;">DOMESTIC APPROVAL REQUEST · ${escapeHtml(data.publicId)}</div>
        <h1 style="margin:18px 0 10px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.15;font-weight:500;">A request has landed on your desk.</h1>
        <p style="margin:0 auto 26px;max-width:520px;text-align:center;color:#667078;font-size:15px;line-height:1.6;">${escapeHtml(data.requesterName)} used Permission Granted to send you this playful request.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #cfc7b8;">${requestRows(data)}</table>
        <div style="margin-top:24px;color:#1c2933;font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;letter-spacing:1.5px;">YOUR DECISION</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:10px;">
          <tr>
            <td width="49%" align="center" style="padding-right:6px;">
              <a href="${escapeHtml(links.approveUrl)}" style="display:block;padding:15px 8px;border:2px solid #2d7458;color:#2d7458;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:19px;">✓&nbsp; Approve</a>
            </td>
            <td width="49%" align="center" style="padding-left:6px;">
              <a href="${escapeHtml(links.declineUrl)}" style="display:block;padding:15px 8px;border:2px solid #a84646;color:#a84646;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:19px;">×&nbsp; Decline</a>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 24px;text-align:center;color:#667078;font-size:12px;line-height:1.6;">You’ll confirm your choice on permissiongranted.app. Clicking this email does not record a decision.</p>
        <div style="padding-top:20px;border-top:1px solid #cfc7b8;text-align:center;color:#667078;font-size:12px;line-height:1.7;">
          This is an unofficial, playful request—not legal consent or a message from an employer, government, or another service.<br>
          <a href="${escapeHtml(links.reportUrl)}" style="color:#285c52;">Report or block</a>&nbsp;&nbsp;·&nbsp;&nbsp;
          <a href="${escapeHtml(links.safetyUrl)}" style="color:#285c52;">Safety</a>&nbsp;&nbsp;·&nbsp;&nbsp;
          <a href="${escapeHtml(links.privacyUrl)}" style="color:#285c52;">Privacy</a>
        </div>
      </td>
    </tr>`;

  return {
    subject,
    html: emailShell(preheader, body),
    text: `${subject}

${data.requesterName} used Permission Granted to send you this playful request.

Request ID: ${data.publicId}
From: ${data.requesterName}
Request: ${data.requestTitle}
Reason: ${data.justification}
Expires: ${formatDate(data.expiresAt)}

Approve (you will confirm on the website):
${links.approveUrl}

Decline (you will confirm on the website):
${links.declineUrl}

Clicking either email link does not record a decision.
Report or block: ${links.reportUrl}
Safety: ${links.safetyUrl}
Privacy: ${links.privacyUrl}`,
  };
}

export function approvalCertificateEmail(
  data: RequestEmailData,
  decidedAt: number,
  manageUrl: string,
): EmailContent {
  const subject = `${data.recipientName} approved your permission request`;
  const preheader = "Permission granted. The record is now officially-ish complete.";
  const body = `
    <tr>
      <td style="padding:12px 44px 32px;">
        <div style="text-align:center;color:#667078;font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;letter-spacing:1.5px;">DOMESTIC APPROVAL RECORD · ${escapeHtml(data.publicId)}</div>
        <h1 style="margin:18px 0 10px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.15;font-weight:500;">${escapeHtml(data.recipientName)} has returned a verdict.</h1>
        <p style="margin:0 auto 26px;text-align:center;color:#667078;font-size:15px;line-height:1.6;">Your request was approved. Retain this highly unofficial record for your files.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:3px double #9e9584;">
          <tr><td style="padding:26px 28px;">
            <h2 style="margin:0 0 16px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:25px;letter-spacing:4px;font-weight:500;">CERTIFICATE OF APPROVAL</h2>
            <div style="margin-bottom:16px;text-align:center;color:#667078;font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;letter-spacing:1px;">REQUEST ID&nbsp; ${escapeHtml(data.publicId)} &nbsp;&nbsp;·&nbsp;&nbsp; DECIDED&nbsp; ${escapeHtml(formatDecisionDate(decidedAt))}</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td width="28%" style="padding:10px 8px;border-top:1px solid #cfc7b8;color:#667078;font-family:Consolas,monospace;font-size:11px;letter-spacing:1px;">REQUESTED BY</td><td style="padding:10px 8px;border-top:1px solid #cfc7b8;font-family:Georgia,serif;font-size:18px;">${escapeHtml(data.requesterName)}</td></tr>
              <tr><td style="padding:10px 8px;border-top:1px solid #cfc7b8;color:#667078;font-family:Consolas,monospace;font-size:11px;letter-spacing:1px;">DECIDED BY</td><td style="padding:10px 8px;border-top:1px solid #cfc7b8;font-family:Georgia,serif;font-size:18px;">${escapeHtml(data.recipientName)}</td></tr>
              <tr><td style="padding:10px 8px;border-top:1px solid #cfc7b8;color:#667078;font-family:Consolas,monospace;font-size:11px;letter-spacing:1px;">REQUEST</td><td style="padding:10px 8px;border-top:1px solid #cfc7b8;font-family:Georgia,serif;font-size:18px;">${escapeHtml(data.requestTitle)}</td></tr>
            </table>
            <div style="margin:26px auto 22px;max-width:360px;padding:12px;border:4px double #2d7458;color:#2d7458;text-align:center;font-family:'IBM Plex Mono',Consolas,monospace;font-size:24px;font-weight:700;letter-spacing:2px;transform:rotate(-2deg);">PERMISSION GRANTED</div>
            <div style="padding-top:14px;border-top:1px solid #cfc7b8;text-align:center;color:#667078;font-family:Georgia,serif;font-size:12px;font-style:italic;">Recorded by Permission Granted</div>
            <div style="margin-top:7px;text-align:center;color:#667078;font-size:11px;">For entertainment purposes. No legal force whatsoever.</div>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr><td align="center" style="padding:26px 0 10px;">
            <a href="${escapeHtml(manageUrl)}" style="display:inline-block;padding:14px 26px;background:#285c52;color:#ffffff;text-decoration:none;font-weight:700;border:1px solid #285c52;">View request record</a>
          </td></tr>
        </table>
        <p style="margin:6px 0 0;text-align:center;color:#667078;font-size:12px;">This notification was sent because you created and verified request ${escapeHtml(data.publicId)}.</p>
      </td>
    </tr>`;

  return {
    subject,
    html: emailShell(preheader, body),
    text: `${subject}

CERTIFICATE OF APPROVAL
Request ID: ${data.publicId}
Requested by: ${data.requesterName}
Decided by: ${data.recipientName}
Request: ${data.requestTitle}
Decided: ${formatDecisionDate(decidedAt)}

PERMISSION GRANTED

For entertainment purposes. No legal force whatsoever.
View request record: ${manageUrl}`,
  };
}

export function declineNoticeEmail(
  data: RequestEmailData,
  decidedAt: number,
  manageUrl: string,
): EmailContent {
  const subject = `${data.recipientName} declined your permission request`;
  const preheader = "A verdict has been recorded.";
  const body = `
    <tr>
      <td style="padding:12px 44px 34px;text-align:center;">
        <div style="color:#667078;font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;letter-spacing:1.5px;">DOMESTIC APPROVAL RECORD · ${escapeHtml(data.publicId)}</div>
        <h1 style="margin:18px 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.15;font-weight:500;">${escapeHtml(data.recipientName)} has returned a verdict.</h1>
        <p style="margin:0 0 26px;color:#667078;font-size:15px;line-height:1.6;">The request below was declined. No explanation was required.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #cfc7b8;text-align:left;">${requestRows(data)}</table>
        <div style="margin:28px auto 20px;max-width:280px;padding:12px;border:4px double #a84646;color:#a84646;font-family:'IBM Plex Mono',Consolas,monospace;font-size:24px;font-weight:700;letter-spacing:3px;transform:rotate(-2deg);">DECLINED</div>
        <div style="color:#667078;font-size:12px;">Decision recorded ${escapeHtml(formatDecisionDate(decidedAt))}</div>
        <div style="padding-top:26px;">
          <a href="${escapeHtml(manageUrl)}" style="display:inline-block;padding:14px 26px;background:#285c52;color:#ffffff;text-decoration:none;font-weight:700;border:1px solid #285c52;">View request record</a>
        </div>
      </td>
    </tr>`;

  return {
    subject,
    html: emailShell(preheader, body),
    text: `${subject}

Request ID: ${data.publicId}
Request: ${data.requestTitle}
Decision: DECLINED
Decided: ${formatDecisionDate(decidedAt)}

No explanation was required.
View request record: ${manageUrl}`,
  };
}
