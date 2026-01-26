"""Email services - MOCKED"""
import logging
import os

# SMTP Config - Loaded from environment when configured
SMTP_HOST = os.environ.get('SMTP_HOST', '')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SMTP_FROM = os.environ.get('SMTP_FROM', '')


async def send_email_notification(to_email: str, subject: str, body: str):
    """Send email notification - MOCKED"""
    # In production, this would use real SMTP
    # For now, just log the email
    logging.info(f"[MOCKED EMAIL] To: {to_email}, Subject: {subject}")
    logging.info(f"[MOCKED EMAIL] Body: {body[:200]}...")
    print(f"\n{'='*50}")
    print(f"📧 MOCKED EMAIL NOTIFICATION")
    print(f"To: {to_email}")
    print(f"Subject: {subject}")
    print(f"Body: {body[:500]}{'...' if len(body) > 500 else ''}")
    print(f"{'='*50}\n")
    return True


async def send_password_reset_email(to_email: str, user_name: str, reset_link: str):
    """Send password reset email - MOCKED"""
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
    return await send_email_notification(to_email, subject, body)


async def send_satisfaction_survey_email(to_email: str, requester_name: str, resolver_name: str, 
                                          order_code: str, order_title: str, survey_link: str):
    """Send satisfaction survey email - MOCKED"""
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
    return await send_email_notification(to_email, subject, body)
