import { Resend } from 'resend';

const FROM =
  process.env.INVITE_FROM_EMAIL ?? 'Providence Academy <noreply@example.org>';

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set.');
  return new Resend(key);
}

interface InviteOptions {
  to: string;
  firstName: string;
  signInUrl: string;
  appUrl: string;
}

/**
 * The invitation.
 *
 * The one job of this email is to get the app onto a home screen. On iOS,
 * notifications only work for an installed app, so an invitation that gets
 * someone to sign in but not install produces a silent account.
 */
export function inviteEmail({ firstName, signInUrl, appUrl }: InviteOptions) {
  const greeting = firstName ? `Hello ${firstName},` : 'Hello,';

  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:'Open Sans',Segoe UI,Helvetica,Arial,sans-serif;color:#1c1c1c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#032341;padding:28px 32px;text-align:center;">
              <div style="font-family:Garamond,Georgia,serif;font-size:24px;color:#ffffff;letter-spacing:0.5px;">
                PROVIDENCE ACADEMY
              </div>
              <div style="font-size:13px;color:rgba(255,255,255,0.72);margin-top:4px;">
                Community App
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;">${greeting}</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
                Providence is moving school communication into one place. The new
                community app replaces the Facebook groups, GroupMe threads, and
                most of the email you get from us.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.55;">
                You will see announcements for your children's divisions and
                grades, the school calendar, handbooks, lunch menus, and the
                staff directory. Nothing for grades your children are not in.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr><td style="background:#CB122D;border-radius:4px;">
                  <a href="${signInUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Open the app
                  </a>
                </td></tr>
              </table>

              <div style="border-top:1px solid #e5e5e5;padding-top:22px;">
                <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#032341;">
                  One more step, and it matters
                </p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.55;">
                  Add the app to your phone's home screen. Notifications only
                  work once you do, so without this step you will not hear about
                  weather closings or early dismissals.
                </p>
                <p style="margin:0 0 6px;font-size:14px;line-height:1.5;">
                  <strong>iPhone:</strong> open the link in Safari, tap the Share
                  button, then "Add to Home Screen."
                </p>
                <p style="margin:0;font-size:14px;line-height:1.5;">
                  <strong>Android:</strong> open the link in Chrome, tap the menu,
                  then "Install app" or "Add to Home screen."
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f5f5f4;padding:18px 32px;text-align:center;font-size:12px;color:#6b6b6b;">
              You are receiving this because your family is enrolled at
              Providence Academy.<br />
              <a href="${appUrl}" style="color:#003A70;">${appUrl.replace(/^https?:\/\//, '')}</a>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  const text = `${greeting}

Providence is moving school communication into one place. The new community app replaces the Facebook groups, GroupMe threads, and most of the email you get from us.

You will see announcements for your children's divisions and grades, the school calendar, handbooks, lunch menus, and the staff directory. Nothing for grades your children are not in.

Open the app: ${signInUrl}

ONE MORE STEP, AND IT MATTERS
Add the app to your phone's home screen. Notifications only work once you do, so without this step you will not hear about weather closings or early dismissals.

iPhone: open the link in Safari, tap Share, then "Add to Home Screen."
Android: open the link in Chrome, tap the menu, then "Install app."

You are receiving this because your family is enrolled at Providence Academy.
${appUrl}`;

  return {
    from: FROM,
    subject: 'Your Providence Academy app is ready',
    html,
    text,
  };
}
