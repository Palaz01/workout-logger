import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

const getFromEmail = () => process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function sendVerificationEmail(
  to: string,
  name: string,
  verificationUrl: string
): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: "Verify your email address",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#6366f1;padding:32px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;">Welcome!</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${name}</strong>,
      </p>
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 24px;">
        Thanks for registering! Please verify your email address by clicking the button below.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${verificationUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:16px;">
          Verify Email
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:24px 0 0;">
        This link will expire in 24 hours. If you didn't create an account, you can ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
        If the button doesn't work, copy and paste this link:<br>
        <a href="${verificationUrl}" style="color:#6366f1;word-break:break-all;">${verificationUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  });
}

export async function sendInvitationEmail(
  to: string,
  inviteeName: string,
  organizationName: string,
  trainerName: string,
  role: string,
  inviteUrl: string
): Promise<void> {
  const resend = getResend();
  const roleLabel = role === "trainer" ? "Trainer" : "Client";
  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: `You've been invited to join ${organizationName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#6366f1;padding:32px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;">You're Invited!</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${inviteeName}</strong>,
      </p>
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 24px;">
        <strong>${trainerName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${roleLabel}</strong>.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${inviteUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:16px;">
          Accept Invitation
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:24px 0 0;">
        This invitation expires in 7 days. Click the button above to set up your account.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
        If the button doesn't work, copy and paste this link:<br>
        <a href="${inviteUrl}" style="color:#6366f1;word-break:break-all;">${inviteUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  });
}
