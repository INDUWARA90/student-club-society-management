package com.club.backend.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Year;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class MailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.mail.from:}")
    private String configuredFrom;

    public String getEffectiveFromAddress() {
        if (configuredFrom != null && !configuredFrom.isBlank()) {
            return configuredFrom.trim();
        }
        if (mailUsername != null && !mailUsername.isBlank()) {
            return mailUsername.trim();
        }
        return "noreply@campusclubs.edu";
    }

    public boolean isMailConfigured() {
        return (mailUsername != null && !mailUsername.isBlank())
                || (configuredFrom != null && !configuredFrom.isBlank());
    }

    @Async
    public void sendNotificationEmail(String toEmail, String message) {
        String subject = "Club & Society Management Notification";
        String plainText = "Campus Club & Society Management Notification\n\n"
                + message + "\n\n"
                + "View your notifications: " + frontendUrl + "/notifications\n";

        String html = buildEmailLayout(
                "System Notification",
                "Campus Notification",
                "#4f46e5",
                "<p style=\"font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 20px;\">"
                        + "You have received an update regarding your campus clubs and activities:"
                        + "</p>"
                        + "<div style=\"background-color: #f8fafc; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 18px 20px; margin: 20px 0; color: #1e293b; font-size: 15px; line-height: 1.6;\">"
                        + nl2br(escapeHtml(message))
                        + "</div>",
                "View My Notifications",
                frontendUrl + "/notifications",
                null,
                "You received this notification because your account email notifications are enabled. You can adjust your email preferences anytime in your account settings."
        );

        sendEmail(toEmail, subject, plainText, html);
    }

    @Async
    public void sendVerificationEmail(String toEmail, String token) {
        String verifyLink = frontendUrl + "/verify-email?token=" + token;
        String subject = "Verify Your Email - Campus Club & Society";
        String plainText = "Welcome to Campus Club & Society!\n\n"
                + "Please verify your email address by opening the link below:\n\n"
                + verifyLink + "\n\n"
                + "This verification link is valid for 24 hours. If you did not create an account, you can safely ignore this email.\n";

        String html = buildEmailLayout(
                "Account Activation",
                "Verify Your Email Address",
                "#059669",
                "<p style=\"font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 16px;\">"
                        + "Welcome to <strong>Campus Club &amp; Society Portal</strong>! We're excited to have you join our vibrant campus community."
                        + "</p>"
                        + "<p style=\"font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;\">"
                        + "To unlock full access to club memberships, campus events, discussions, and certificates, please confirm your email address by clicking the button below:"
                        + "</p>",
                "Verify Email Address",
                verifyLink,
                "<p style=\"font-size: 13px; color: #64748b; margin-top: 16px;\">"
                        + "⏰ <strong>Note:</strong> This verification link is valid for <strong>24 hours</strong>.<br>"
                        + "If the button above doesn't work, copy and paste this link into your browser:<br>"
                        + "<a href=\"" + verifyLink + "\" style=\"color: #4f46e5; word-break: break-all; font-size: 12px;\">" + verifyLink + "</a>"
                        + "</p>",
                "If you did not register for an account on the Campus Club & Society Portal, no further action is required and you can safely disregard this email."
        );

        sendEmail(toEmail, subject, plainText, html);
    }

    /** Sent instead of a verification link when someone registers with an address that already has an account. */
    @Async
    public void sendAccountExistsEmail(String toEmail) {
        String loginLink = frontendUrl + "/login";
        String resetLink = frontendUrl + "/forgot-password";
        String subject = "Account Notice: Registration Attempt - Campus Club & Society";
        String plainText = "Someone tried to create a Campus Club & Society account with this email address, "
                + "but an account already exists.\n\n"
                + "Sign in: " + loginLink + "\n"
                + "Reset password: " + resetLink + "\n\n"
                + "If this wasn't you, you can safely ignore this email. Your account remains secure.\n";

        String html = buildEmailLayout(
                "Security Notice",
                "Account Already Exists",
                "#d97706",
                "<p style=\"font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 16px;\">"
                        + "Someone recently attempted to create a new <strong>Campus Club &amp; Society</strong> account using this email address."
                        + "</p>"
                        + "<div style=\"background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 20px 0; font-size: 14px; color: #92400e;\">"
                        + "<strong>Good news:</strong> An account is already registered with this email, so no duplicate account was created and your existing profile remains completely secure."
                        + "</div>"
                        + "<p style=\"font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;\">"
                        + "If this was you, you can simply sign in to access your clubs, or reset your password if you've forgotten it:"
                        + "</p>",
                "Sign In to Your Account",
                loginLink,
                "<p style=\"font-size: 13px; color: #64748b; margin-top: 16px;\">"
                        + "Forgot your password? <a href=\"" + resetLink + "\" style=\"color: #4f46e5; font-weight: 600;\">Reset your password here</a>."
                        + "</p>",
                "If you did not attempt this registration, someone may have entered your email address by mistake. Your account is safe and no changes were made."
        );

        sendEmail(toEmail, subject, plainText, html);
    }

    @Async
    public void sendDigestEmail(String toEmail, String name, List<String> messages) {
        String subject = "Your Daily Campus Digest - Club & Society Hub";
        StringBuilder plainText = new StringBuilder("Hi " + name + ",\n\nHere is what happened on Campus Club & Society in the last 24 hours:\n\n");
        messages.forEach(m -> plainText.append("• ").append(m).append("\n"));
        plainText.append("\nOpen notifications: ").append(frontendUrl).append("/notifications\n");

        StringBuilder listHtml = new StringBuilder();
        listHtml.append("<div style=\"margin: 20px 0;\">");
        for (String msg : messages) {
            listHtml.append("<div style=\"background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; display: flex; align-items: flex-start;\">")
                    .append("<span style=\"color: #4f46e5; font-size: 16px; margin-right: 10px; line-height: 1;\">🔹</span>")
                    .append("<span style=\"color: #1e293b; font-size: 14px; line-height: 1.5;\">")
                    .append(escapeHtml(msg))
                    .append("</span></div>");
        }
        listHtml.append("</div>");

        String html = buildEmailLayout(
                "Daily Summary",
                "Your 24-Hour Campus Digest",
                "#2563eb",
                "<p style=\"font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 16px;\">"
                        + "Hi <strong>" + escapeHtml(name) + "</strong>, here is your daily summary of the latest updates, announcements, and events from your clubs and societies:"
                        + "</p>"
                        + listHtml.toString(),
                "Go to Notification Center",
                frontendUrl + "/notifications",
                null,
                "You are receiving this summary because Daily Digest mode is enabled on your account. To change frequency, manage notifications in your account settings."
        );

        sendEmail(toEmail, subject, plainText.toString(), html);
    }

    @Async
    public void sendPasswordResetEmail(String toEmail, String token) {
        String resetLink = frontendUrl + "/reset-password?token=" + token;
        String subject = "Password Reset Request - Campus Club & Society";
        String plainText = "Password Reset Request\n\n"
                + "Click the link below to choose a new password:\n\n"
                + resetLink + "\n\n"
                + "This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.\n";

        String html = buildEmailLayout(
                "Account Security",
                "Reset Your Password",
                "#dc2626",
                "<p style=\"font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 16px;\">"
                        + "We received a request to reset the password for your <strong>Campus Club &amp; Society</strong> account."
                        + "</p>"
                        + "<p style=\"font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 24px;\">"
                        + "Click the button below to choose a new password and regain access to your account:"
                        + "</p>",
                "Reset Password",
                resetLink,
                "<div style=\"background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px; margin-top: 20px; font-size: 13px; color: #991b1b;\">"
                        + "⚠️ <strong>Security Notice:</strong> This reset link will expire in <strong>1 hour</strong>.<br>"
                        + "If you did not make this request, please ignore this email or review your account if you suspect unauthorized activity."
                        + "</div>"
                        + "<p style=\"font-size: 12px; color: #64748b; margin-top: 14px;\">"
                        + "Alternative link:<br><a href=\"" + resetLink + "\" style=\"color: #4f46e5; word-break: break-all; font-size: 12px;\">" + resetLink + "</a>"
                        + "</p>",
                "We will never ask you for your account password via email or phone."
        );

        sendEmail(toEmail, subject, plainText, html);
    }

    @Async
    public void sendAdvisorContactEmail(
            String advisorEmail,
            String advisorName,
            String studentName,
            String studentEmail,
            String inquirySubject,
            String inquiryMessage,
            String clubName) {

        String safeSubject = escapeHtml(inquirySubject);
        String safeStudentName = escapeHtml(studentName);
        String safeStudentEmail = escapeHtml(studentEmail);
        String safeClubName = clubName != null && !clubName.isBlank() ? escapeHtml(clubName) : "General Campus Inquiry";

        String subject = "Student Advisory Inquiry: " + inquirySubject + " (" + studentName + ")";
        String replyMailto = "mailto:" + studentEmail + "?subject="
                + URLEncoder.encode("Re: " + inquirySubject, StandardCharsets.UTF_8);

        String plainText = "New Student Advisory Inquiry\n\n"
                + "From: " + studentName + " <" + studentEmail + ">\n"
                + "Club / Context: " + (clubName != null ? clubName : "General") + "\n"
                + "Subject: " + inquirySubject + "\n\n"
                + "Message:\n" + inquiryMessage + "\n\n"
                + "Reply directly to: " + studentEmail + "\n";

        String html = buildEmailLayout(
                "Faculty Advisory",
                "New Student Advisory Inquiry",
                "#7c3aed",
                "<p style=\"font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 20px;\">"
                        + "Dear <strong>" + escapeHtml(advisorName) + "</strong>,"
                        + "<br><br>"
                        + "A student has submitted an inquiry to you via the <strong>Campus Club &amp; Society Advisory Channel</strong>:"
                        + "</p>"
                        + "<div style=\"background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 20px;\">"
                        + "  <table style=\"width: 100%; border-collapse: collapse; font-size: 14px;\">"
                        + "    <tr>"
                        + "      <td style=\"padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;\">Student:</td>"
                        + "      <td style=\"padding: 6px 0; color: #0f172a; font-weight: 600;\">" + safeStudentName + "</td>"
                        + "    </tr>"
                        + "    <tr>"
                        + "      <td style=\"padding: 6px 0; color: #64748b; font-weight: 600;\">Student Email:</td>"
                        + "      <td style=\"padding: 6px 0; color: #0f172a;\"><a href=\"" + replyMailto + "\" style=\"color: #4f46e5;\">" + safeStudentEmail + "</a></td>"
                        + "    </tr>"
                        + "    <tr>"
                        + "      <td style=\"padding: 6px 0; color: #64748b; font-weight: 600;\">Club Context:</td>"
                        + "      <td style=\"padding: 6px 0; color: #0f172a;\">" + safeClubName + "</td>"
                        + "    </tr>"
                        + "    <tr>"
                        + "      <td style=\"padding: 6px 0; color: #64748b; font-weight: 600;\">Subject:</td>"
                        + "      <td style=\"padding: 6px 0; color: #0f172a; font-weight: 600;\">" + safeSubject + "</td>"
                        + "    </tr>"
                        + "  </table>"
                        + "</div>"
                        + "<div style=\"margin: 20px 0;\">"
                        + "  <div style=\"font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px;\">Student Message:</div>"
                        + "  <div style=\"background-color: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #7c3aed; border-radius: 6px; padding: 18px 20px; color: #1e293b; font-size: 15px; line-height: 1.6; white-space: pre-wrap;\">"
                        + escapeHtml(inquiryMessage)
                        + "  </div>"
                        + "</div>",
                "Reply to " + studentName,
                replyMailto,
                "<p style=\"font-size: 13px; color: #64748b; margin-top: 16px;\">"
                        + "You can reply directly by clicking the button above or emailing <a href=\"" + replyMailto + "\" style=\"color: #4f46e5;\">" + safeStudentEmail + "</a>."
                        + "</p>",
                "You received this inquiry because you are registered as a Faculty Advisor in the Campus Club & Society Portal."
        );

        sendEmail(advisorEmail, subject, plainText, html);
    }

    private void sendEmail(String toEmail, String subject, String plainText, String htmlContent) {
        if (!isMailConfigured()) {
            log.warn("Email sending skipped for {}: MAIL_USERNAME or APP_MAIL_FROM is not configured in environment.", toEmail);
            return;
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            String sender = getEffectiveFromAddress();
            helper.setFrom(sender, "Campus Club & Society Portal");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plainText, htmlContent);
            mailSender.send(mimeMessage);
            log.info("Email successfully dispatched to {} [subject: '{}']", toEmail, subject);
        } catch (Exception e) {
            log.error("Failed to send email to {} [subject: '{}']: {}", toEmail, subject, e.getMessage(), e);
        }
    }

    public void sendTestEmail(String toEmail) {
        String subject = "Test Verification Email - Campus Club & Society Portal";
        String plainText = "This is a test email sent from Campus Club & Society to verify SMTP delivery.\n"
                + "If you received this message, your mail server is properly configured!";
        String html = buildEmailLayout(
                "SMTP Test",
                "Mail Delivery Verification",
                "#10b981",
                "<p style=\"font-size: 15px; color: #334155; line-height: 1.6;\">"
                        + "Congratulations! If you are reading this email, the <strong>Campus Club &amp; Society Portal</strong> "
                        + "has successfully connected to your SMTP relay server and dispatched this message."
                        + "</p>"
                        + "<div style=\"background-color: #ecfdf5; border: 1px solid #a7f3d0; border-left: 4px solid #10b981; border-radius: 6px; padding: 16px; margin: 20px 0; font-size: 14px; color: #065f46;\">"
                        + "✓ SMTP Configuration is <strong>Active &amp; Working</strong>.<br>"
                        + "Delivered to: <strong>" + escapeHtml(toEmail) + "</strong>"
                        + "</div>",
                "Visit Portal",
                frontendUrl,
                null,
                "This verification email was triggered from the system administrative console."
        );

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            String sender = getEffectiveFromAddress();
            helper.setFrom(sender, "Campus Club & Society Portal");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(plainText, html);
            mailSender.send(mimeMessage);
            log.info("Test email successfully dispatched to {}", toEmail);
        } catch (Exception e) {
            log.error("Test email sending failed to {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("SMTP delivery failed: " + e.getMessage(), e);
        }
    }

    private String buildEmailLayout(
            String badgeText,
            String heading,
            String badgeColor,
            String bodyContent,
            String buttonText,
            String buttonUrl,
            String extraHtml,
            String footerNote) {

        int currentYear = Year.now().getValue();
        String buttonSection = "";
        if (buttonText != null && buttonUrl != null) {
            buttonSection = "<div style=\"text-align: center; margin: 28px 0 20px 0;\">"
                    + "  <a href=\"" + buttonUrl + "\" "
                    + "     style=\"background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 14px 34px; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); letter-spacing: 0.02em;\">"
                    + escapeHtml(buttonText)
                    + "  </a>"
                    + "</div>";
        }

        return "<!DOCTYPE html>"
                + "<html lang=\"en\">"
                + "<head>"
                + "  <meta charset=\"UTF-8\">"
                + "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
                + "  <title>" + escapeHtml(heading) + "</title>"
                + "</head>"
                + "<body style=\"margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;\">"
                + "  <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color: #f1f5f9; padding: 36px 12px;\">"
                + "    <tr>"
                + "      <td align=\"center\">"
                + "        <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;\">"
                + "          <!-- Header Banner -->"
                + "          <tr>"
                + "            <td style=\"background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 30px; text-align: center;\">"
                + "              <div style=\"display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background: rgba(255, 255, 255, 0.2); color: #ffffff; font-weight: 800; font-size: 18px; margin-bottom: 12px;\">C&amp;S</div>"
                + "              <div style=\"color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;\">Campus Club &amp; Society</div>"
                + "              <div style=\"color: rgba(255, 255, 255, 0.82); font-size: 13px; font-weight: 400; margin-top: 4px;\">Student Engagement &amp; Activity Portal</div>"
                + "            </td>"
                + "          </tr>"
                + "          <!-- Body Container -->"
                + "          <tr>"
                + "            <td style=\"padding: 36px 32px; background-color: #ffffff;\">"
                + "              <div style=\"margin-bottom: 18px;\">"
                + "                <span style=\"display: inline-block; background-color: " + badgeColor + "15; color: " + badgeColor + "; border: 1px solid " + badgeColor + "30; border-radius: 9999px; padding: 4px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;\">"
                + escapeHtml(badgeText)
                + "                </span>"
                + "              </div>"
                + "              <h1 style=\"margin: 0 0 18px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;\">"
                + escapeHtml(heading)
                + "              </h1>"
                + bodyContent
                + buttonSection
                + (extraHtml != null ? extraHtml : "")
                + "            </td>"
                + "          </tr>"
                + "          <!-- Footer -->"
                + "          <tr>"
                + "            <td style=\"background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;\">"
                + "              <p style=\"margin: 0 0 8px 0; font-size: 13px; color: #64748b; font-weight: 500;\">"
                + "                <a href=\"" + frontendUrl + "\" style=\"color: #4f46e5; text-decoration: none;\">Campus Club &amp; Society Hub</a> &bull; Official Student Portal"
                + "              </p>"
                + (footerNote != null ? "<p style=\"margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;\">" + escapeHtml(footerNote) + "</p>" : "")
                + "              <p style=\"margin: 0; font-size: 11px; color: #94a3b8;\">"
                + "                &copy; " + currentYear + " Campus Club &amp; Society Management System. All rights reserved."
                + "              </p>"
                + "            </td>"
                + "          </tr>"
                + "        </table>"
                + "      </td>"
                + "    </tr>"
                + "  </table>"
                + "</body>"
                + "</html>";
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String nl2br(String text) {
        if (text == null) return "";
        return text.replace("\r\n", "<br>").replace("\n", "<br>");
    }
}
