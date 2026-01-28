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
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')


async def send_email_notification(to_email: str, subject: str, body: str, html_body: str = None):
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
        if html_body:
            html_part = MIMEText(html_body, 'html')
        else:
            html_content = body.replace('\n', '<br>').replace('    ', '&nbsp;&nbsp;&nbsp;&nbsp;')
            html_part = MIMEText(f"<html><body>{html_content}</body></html>", 'html')
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


def get_email_template(template_type: str, data: dict) -> tuple:
    """Get email subject and body for different notification types"""
    order_url = f"{FRONTEND_URL}/orders/{data.get('order_id', '')}"
    
    templates = {
        "ticket_created": {
            "subject": f"[Red Ops] Ticket Created: {data.get('order_code')} - {data.get('title', '')}",
            "body": f"""
Hello {data.get('requester_name', '')},

Your ticket has been successfully created!

Ticket Details:
- Code: {data.get('order_code')}
- Title: {data.get('title')}
- Priority: {data.get('priority', 'Normal')}
- Category: {data.get('category', 'General')}

You can track your ticket here: {order_url}

We will notify you when your ticket is picked up by a team member.

Best regards,
Red Ops Team
            """
        },
        "ticket_assigned": {
            "subject": f"[Red Ops] Ticket Assigned: {data.get('order_code')} - {data.get('title', '')}",
            "body": f"""
Hello {data.get('resolver_name', '')},

A new ticket has been assigned to you!

Ticket Details:
- Code: {data.get('order_code')}
- Title: {data.get('title')}
- Priority: {data.get('priority', 'Normal')}
- Requester: {data.get('requester_name')}

View ticket: {order_url}

Please review and begin work on this ticket.

Best regards,
Red Ops Team
            """
        },
        "ticket_picked_up": {
            "subject": f"[Red Ops] Your Ticket Has Been Picked Up: {data.get('order_code')}",
            "body": f"""
Hello {data.get('requester_name', '')},

Great news! Your ticket has been picked up and work has begun.

Ticket Details:
- Code: {data.get('order_code')}
- Title: {data.get('title')}
- Assigned To: {data.get('resolver_name', 'Team Member')}

Track progress: {order_url}

You will be notified when there are updates or when your ticket is resolved.

Best regards,
Red Ops Team
            """
        },
        "ticket_resolved": {
            "subject": f"[Red Ops] Ticket Resolved: {data.get('order_code')} - {data.get('title', '')}",
            "body": f"""
Hello {data.get('requester_name', '')},

Your ticket has been resolved/delivered!

Ticket Details:
- Code: {data.get('order_code')}
- Title: {data.get('title')}
- Resolved By: {data.get('resolver_name', 'Team')}
- Resolution Notes: {data.get('resolution_notes', 'N/A')}

View details: {order_url}

Please review and let us know if you have any questions.

Best regards,
Red Ops Team
            """
        },
        "ticket_cancelled": {
            "subject": f"[Red Ops] Ticket Cancelled: {data.get('order_code')}",
            "body": f"""
Hello {data.get('to_name', '')},

A ticket has been cancelled by the requester.

Ticket Details:
- Code: {data.get('order_code')}
- Title: {data.get('title')}
- Cancelled By: {data.get('cancelled_by', '')}
- Reason: {data.get('cancel_reason', 'Not specified')}

View details: {order_url}

No further action is required on this ticket.

Best regards,
Red Ops Team
            """
        },
        "pool_assignment": {
            "subject": f"[Red Ops] New Ticket Available in Your Pool: {data.get('order_code')}",
            "body": f"""
Hello {data.get('to_name', 'Team')},

A new ticket is available in your pool!

Ticket Details:
- Code: {data.get('order_code')}
- Title: {data.get('title')}
- Priority: {data.get('priority', 'Normal')}
- Category: {data.get('category', 'General')}
- Pool: {data.get('pool_name', 'Your Pool')}

View and pick up: {order_url}

First come, first served - pick it up before someone else does!

Best regards,
Red Ops Team
            """
        },
        "ticket_reopened": {
            "subject": f"[Red Ops] Ticket Reopened: {data.get('order_code')}",
            "body": f"""
Hello {data.get('to_name', '')},

A ticket has been reopened.

Ticket Details:
- Code: {data.get('order_code')}
- Title: {data.get('title')}
- Reopened By: {data.get('reopened_by', 'Admin')}
- Reason: {data.get('reopen_reason', 'Not specified')}

View details: {order_url}

Best regards,
Red Ops Team
            """
        },
        "ticket_reassigned": {
            "subject": f"[Red Ops] Ticket Reassigned: {data.get('order_code')}",
            "body": f"""
Hello {data.get('to_name', '')},

A ticket has been reassigned.

Ticket Details:
- Code: {data.get('order_code')}
- Title: {data.get('title')}
- From: {data.get('from_name', 'N/A')}
- To: {data.get('to_target', 'N/A')}
- Reassigned By: {data.get('reassigned_by', '')}
- Reason: {data.get('reason', 'Not specified')}

View details: {order_url}

Best regards,
Red Ops Team
            """
        }
    }
    
    template = templates.get(template_type, {})
    return template.get("subject", "Red Ops Notification"), template.get("body", "").strip()


async def send_ticket_created_email(requester_email: str, requester_name: str, order_code: str, 
                                     title: str, priority: str, category: str, order_id: str):
    """Send email when a new ticket is created"""
    subject, body = get_email_template("ticket_created", {
        "requester_name": requester_name,
        "order_code": order_code,
        "title": title,
        "priority": priority,
        "category": category,
        "order_id": order_id
    })
    return await send_email_notification(requester_email, subject, body)


async def send_ticket_assigned_email(resolver_email: str, resolver_name: str, requester_name: str,
                                      order_code: str, title: str, priority: str, order_id: str):
    """Send email when a ticket is assigned to a resolver"""
    subject, body = get_email_template("ticket_assigned", {
        "resolver_name": resolver_name,
        "requester_name": requester_name,
        "order_code": order_code,
        "title": title,
        "priority": priority,
        "order_id": order_id
    })
    return await send_email_notification(resolver_email, subject, body)


async def send_ticket_picked_up_email(requester_email: str, requester_name: str, resolver_name: str,
                                       order_code: str, title: str, order_id: str):
    """Send email to requester when their ticket is picked up"""
    subject, body = get_email_template("ticket_picked_up", {
        "requester_name": requester_name,
        "resolver_name": resolver_name,
        "order_code": order_code,
        "title": title,
        "order_id": order_id
    })
    return await send_email_notification(requester_email, subject, body)


async def send_ticket_resolved_email(requester_email: str, requester_name: str, resolver_name: str,
                                      order_code: str, title: str, resolution_notes: str, order_id: str):
    """Send email when a ticket is resolved/delivered"""
    subject, body = get_email_template("ticket_resolved", {
        "requester_name": requester_name,
        "resolver_name": resolver_name,
        "order_code": order_code,
        "title": title,
        "resolution_notes": resolution_notes,
        "order_id": order_id
    })
    return await send_email_notification(requester_email, subject, body)


async def send_ticket_cancelled_email(to_email: str, to_name: str, cancelled_by: str,
                                       order_code: str, title: str, cancel_reason: str, order_id: str):
    """Send email when a ticket is cancelled (to resolver/admin, NOT to requester)"""
    subject, body = get_email_template("ticket_cancelled", {
        "to_name": to_name,
        "cancelled_by": cancelled_by,
        "order_code": order_code,
        "title": title,
        "cancel_reason": cancel_reason,
        "order_id": order_id
    })
    return await send_email_notification(to_email, subject, body)


async def send_pool_assignment_email(to_email: str, to_name: str, order_code: str, 
                                      title: str, priority: str, category: str, 
                                      pool_name: str, order_id: str):
    """Send email when a ticket is assigned to a pool (Partners/Vendors)"""
    subject, body = get_email_template("pool_assignment", {
        "to_name": to_name,
        "order_code": order_code,
        "title": title,
        "priority": priority,
        "category": category,
        "pool_name": pool_name,
        "order_id": order_id
    })
    return await send_email_notification(to_email, subject, body)


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
    """Send satisfaction survey email - ONLY sent when resolver delivers, NOT when requester cancels"""
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
