import { describe, expect, it } from "vitest";
import {
  approvalCertificateEmail,
  recipientRequestEmail,
} from "../src/worker/email-templates";

const request = {
  publicId: "PG-00482",
  requesterName: "Alex",
  recipientName: "Sam",
  requestTitle: "Permission to buy another motorbike",
  justification: "The garage has room if we measure creatively.",
  expiresAt: Date.UTC(2026, 7, 22),
};

describe("transactional email templates", () => {
  it("renders equal approval and decline actions with safe confirmation copy", () => {
    const email = recipientRequestEmail(request, {
      approveUrl: "https://permissiongranted.app/respond/approve-token",
      declineUrl: "https://permissiongranted.app/respond/decline-token",
      reportUrl: "https://permissiongranted.app/report/report-token",
      safetyUrl: "https://permissiongranted.app/safety",
      privacyUrl: "https://permissiongranted.app/privacy",
    });

    expect(email.subject).toBe(
      "Alex sent you a Permission Granted request",
    );
    expect(email.html).toContain(">✓&nbsp; Approve</a>");
    expect(email.html).toContain(">×&nbsp; Decline</a>");
    expect(email.html).toContain(
      "Clicking this email does not record a decision.",
    );
    expect(email.text).toContain(
      "Clicking either email link does not record a decision.",
    );
  });

  it("escapes user content in HTML", () => {
    const email = recipientRequestEmail(
      {
        ...request,
        justification: '<img src=x onerror="alert(1)">',
      },
      {
        approveUrl: "https://permissiongranted.app/respond/a",
        declineUrl: "https://permissiongranted.app/respond/d",
        reportUrl: "https://permissiongranted.app/report/r",
        safetyUrl: "https://permissiongranted.app/safety",
        privacyUrl: "https://permissiongranted.app/privacy",
      },
    );

    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x");
  });

  it("renders the approval as an HTML certificate", () => {
    const email = approvalCertificateEmail(
      request,
      Date.UTC(2026, 6, 23, 9, 42),
      "https://permissiongranted.app/manage/manage-token",
    );

    expect(email.subject).toBe("Sam approved your permission request");
    expect(email.html).toContain("CERTIFICATE OF APPROVAL");
    expect(email.html).toContain("PERMISSION GRANTED");
    expect(email.html).toContain("No legal force whatsoever.");
  });
});
