"""Email services with real SMTP"""
import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# SMTP Config - Loaded from environment
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SMTP_FROM = os.environ.get('SMTP_FROM', '')


async def send_email_notification(to_email: str, subject: str, body: str):
    """Send email notification via SMTP"""
    # Check if SMTP is configured
    if not SMTP_USER or not SMTP_PASSWORD:
        logging.warning("[MOCKED EMAIL] SMTP not configured - email not sent")
        print(f"\n{'='*50}")
        print(f"📧 MOCKED EMAIL (SMTP not configured)")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body: {body[:500]}{'...' if len(body) > 500 else ''}")
        print(f"{'='*50}\n")
        return True
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = SMTP_FROM or SMTP_USER
        msg['To'] = to_email
        
        # Attach plain text body
        text_part = MIMEText(body, 'plain')
        msg.attach(text_part)
        
        # Also create HTML version
        html_body = body.replace('\n', '<br>').replace('    ', '&nbsp;&nbsp;&nbsp;&nbsp;')
        html_part = MIMEText(f"<html><body>{html_body}</body></html>", 'html')
        msg.attach(html_part)
        
        # Send via SMTP
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        logging.info(f"Email sent successfully to {to_email}: {subject}")
        return True
        
    except Exception as e:
        logging.error(f"Failed to send email to {to_email}: {e}")
        print(f"\n{'='*50}")
        print(f"❌ EMAIL FAILED: {e}")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"{'='*50}\n")
        return False


async def send_password_reset_email(to_email: str, user_name: str, reset_link: str):
    """Send password reset email"""
    subject = "Reset Your Password - Red Ops"
    body = f"""
Hello {user_name},

You have requested to reset your password for your Red Ops account.

Click the link below to reset your password:
{reset_link}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email.

Best regards,
Red Ops Team
    """
    return await send_email_notification(to_email, subject, body.strip())


async def send_satisfaction_survey_email(to_email: str, requester_name: str, resolver_name: str, 
                                          order_code: str, order_title: str, survey_link: str):
    """Send satisfaction survey email"""
    subject = f"How was your experience? - {order_code}"
    body = f"""
Hello {requester_name},

Your request "{order_title}" ({order_code}) has been completed by {resolver_name}.

We would love to hear about your experience! Please take a moment to rate the service:

{survey_link}

Your feedback helps us improve our service.

Best regards,
Red Ops Team
    """
    return await send_email_notification(to_email, subject, body.strip())


async def send_test_email(to_email: str):
    """Send a test email to verify SMTP configuration"""
    subject = "email coming from emergent test platform"
    body = """
This is a test email from Red Ops to verify SMTP configuration.

If you received this email, SMTP is working correctly!

Best regards,
Red Ops Team
    """
    return await send_email_notification(to_email, subject, body.strip())
