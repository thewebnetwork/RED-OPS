"""Email services with real SMTP"""
import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load .env file
load_dotenv('/app/backend/.env')

# SMTP Config - Loaded from environment
def get_smtp_config():
    """Get SMTP config from environment - called at runtime to ensure .env is loaded"""
    return {
        'host': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
        'port': int(os.environ.get('SMTP_PORT', 587)),
        'user': os.environ.get('SMTP_USER', ''),
        'password': os.environ.get('SMTP_PASSWORD', ''),
        'from_addr': os.environ.get('SMTP_FROM', ''),
        'frontend_url': os.environ.get('FRONTEND_URL', os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:3000'))
    }


async def send_email_notification(to_email: str, subject: str, body: str, html_body: str = None):
    """Send email notification via SMTP"""
    config = get_smtp_config()
    
    # Check if SMTP is configured
    if not config['user'] or not config['password']:
        logging.warning("[MOCKED EMAIL] SMTP not configured - email not sent")
        print("\n" + "="*50)
        print("📧 MOCKED EMAIL (SMTP not configured)")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body: {body[:500]}{'...' if len(body) > 500 else ''}")
        print("="*50 + "\n")
        return True
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = config['from_addr'] or config['user']
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
        logging.info(f"Sending email via {config['host']}:{config['port']} from {config['from_addr']} to {to_email}")
        port = config['port']
        if port in (465, 2465):
            # SSL connection for port 465/2465
            with smtplib.SMTP_SSL(config['host'], port) as server:
                server.login(config['user'], config['password'])
                server.send_message(msg)
        else:
            # STARTTLS for port 587/2587/25
            with smtplib.SMTP(config['host'], port, timeout=15) as server:
                server.starttls()
                server.login(config['user'], config['password'])
                server.send_message(msg)
        
        logging.info(f"✅ Email sent successfully to {to_email}: {subject}")
        print("\n" + "="*50)
        print("✅ EMAIL SENT SUCCESSFULLY")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print("="*50 + "\n")
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
    config = get_smtp_config()
    order_url = f"{config['frontend_url']}/orders/{data.get('order_id', '')}"
    
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


async def send_account_created_email(to_email: str, user_name: str, temp_password: str, role: str):
    """Send welcome email when a new account is created"""
    config = get_smtp_config()
    login_url = config['frontend_url']
    
    subject = "Welcome to Red Ops - Your Account Has Been Created"
    body = f"""
Hello {user_name},

Welcome to Red Ops! Your account has been created successfully.

Here are your login credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Username: {to_email}
Temporary Password: {temp_password}
Role: {role}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Login URL: {login_url}

IMPORTANT SECURITY NOTES:
• You will be required to change your password on first login
• You may also be prompted to set up Two-Factor Authentication (OTP)
• Please keep your credentials secure and do not share them

If you have any questions or need assistance, please contact your administrator.

Best regards,
Red Ops Team
    """
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #A2182C, #7f1423); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Welcome to Red Ops</h1>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p>Your account has been created successfully. Here are your login credentials:</p>
                
                <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <table style="width: 100%;">
                        <tr><td style="padding: 5px 0; color: #666;">Username:</td><td style="padding: 5px 0;"><strong>{to_email}</strong></td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Temporary Password:</td><td style="padding: 5px 0;"><strong style="font-family: monospace; background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">{temp_password}</strong></td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Role:</td><td style="padding: 5px 0;"><strong>{role}</strong></td></tr>
                    </table>
                </div>
                
                <p style="text-align: center;">
                    <a href="{login_url}" style="display: inline-block; background: #A2182C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Red Ops</a>
                </p>
                
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin-top: 20px;">
                    <strong>⚠️ Important Security Notes:</strong>
                    <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                        <li>You will be required to change your password on first login</li>
                        <li>You may be prompted to set up Two-Factor Authentication</li>
                        <li>Please keep your credentials secure</li>
                    </ul>
                </div>
                
                <p style="color: #666; font-size: 12px; margin-top: 20px; text-align: center;">
                    If you have any questions, please contact your administrator.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email_notification(to_email, subject, body.strip(), html_body)


async def send_account_disabled_email(to_email: str, user_name: str, disabled_by: str = None):
    """Send notification when an account is disabled"""
    subject = "Red Ops - Your Account Has Been Disabled"
    body = f"""
Hello {user_name},

Your Red Ops account ({to_email}) has been disabled.

{f'This action was performed by: {disabled_by}' if disabled_by else ''}

If you believe this was done in error or have questions, please contact your administrator.

Best regards,
Red Ops Team
    """
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #6c757d; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Account Disabled</h1>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p>Your Red Ops account (<strong>{to_email}</strong>) has been disabled.</p>
                {f'<p>This action was performed by: <strong>{disabled_by}</strong></p>' if disabled_by else ''}
                <p>If you believe this was done in error or have questions, please contact your administrator.</p>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">Best regards,<br>Red Ops Team</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email_notification(to_email, subject, body.strip(), html_body)


async def send_account_deleted_email(to_email: str, user_name: str, deleted_by: str = None):
    """Send notification when an account is deleted"""
    subject = "Red Ops - Your Account Has Been Deleted"
    body = f"""
Hello {user_name},

Your Red Ops account ({to_email}) has been permanently deleted from our system.

{f'This action was performed by: {deleted_by}' if deleted_by else ''}

If you believe this was done in error or need to restore your account, please contact your administrator immediately.

Best regards,
Red Ops Team
    """
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Account Deleted</h1>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p>Your Red Ops account (<strong>{to_email}</strong>) has been permanently deleted from our system.</p>
                {f'<p>This action was performed by: <strong>{deleted_by}</strong></p>' if deleted_by else ''}
                <p>If you believe this was done in error or need to restore your account, please contact your administrator immediately.</p>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">Best regards,<br>Red Ops Team</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email_notification(to_email, subject, body.strip(), html_body)


async def send_account_reactivated_email(to_email: str, user_name: str, reactivated_by: str = None):
    """Send notification when an account is reactivated"""
    config = get_smtp_config()
    login_url = config['frontend_url']
    
    subject = "Red Ops - Your Account Has Been Reactivated"
    body = f"""
Hello {user_name},

Great news! Your Red Ops account ({to_email}) has been reactivated.

{f'This action was performed by: {reactivated_by}' if reactivated_by else ''}

You can now log in again at: {login_url}

If you have any questions, please contact your administrator.

Best regards,
Red Ops Team
    """
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #28a745; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Account Reactivated</h1>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello <strong>{user_name}</strong>,</p>
                <p>Great news! Your Red Ops account (<strong>{to_email}</strong>) has been reactivated.</p>
                {f'<p>This action was performed by: <strong>{reactivated_by}</strong></p>' if reactivated_by else ''}
                <p style="text-align: center; margin: 20px 0;">
                    <a href="{login_url}" style="display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Red Ops</a>
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">Best regards,<br>Red Ops Team</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email_notification(to_email, subject, body.strip(), html_body)


# ============== TICKET STATUS CHANGE EMAILS ==============

async def send_ticket_status_changed_email(to_email: str, to_name: str, order_code: str, 
                                           title: str, old_status: str, new_status: str, 
                                           changed_by: str, order_id: str):
    """Send email when ticket status changes"""
    config = get_smtp_config()
    order_url = f"{config['frontend_url']}/orders/{order_id}"
    
    status_messages = {
        "In Progress": "Work has begun on your ticket.",
        "Pending": "Your ticket is pending your review. Please check and respond.",
        "Delivered": "Your ticket has been delivered/resolved.",
        "Closed": "Your ticket has been closed.",
        "Open": "Your ticket is now open and available for pickup.",
    }
    
    status_message = status_messages.get(new_status, f"Status changed to {new_status}.")
    
    subject = f"[Red Ops] Ticket Status Update: {order_code} - {new_status}"
    body = f"""
Hello {to_name},

Your ticket status has been updated.

Ticket Details:
- Code: {order_code}
- Title: {title}
- Previous Status: {old_status}
- New Status: {new_status}
- Updated By: {changed_by}

{status_message}

View ticket: {order_url}

Best regards,
Red Ops Team
    """
    
    # Status-specific colors
    status_colors = {
        "Open": "#3b82f6",
        "In Progress": "#f59e0b", 
        "Pending": "#8b5cf6",
        "Delivered": "#22c55e",
        "Closed": "#64748b",
        "Canceled": "#ef4444"
    }
    color = status_colors.get(new_status, "#6b7280")
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: {color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Ticket Status Update</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">{order_code}</p>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello <strong>{to_name}</strong>,</p>
                <p>Your ticket status has been updated.</p>
                
                <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <table style="width: 100%;">
                        <tr><td style="padding: 5px 0; color: #666;">Title:</td><td style="padding: 5px 0;"><strong>{title}</strong></td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Previous Status:</td><td style="padding: 5px 0;"><span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">{old_status}</span></td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">New Status:</td><td style="padding: 5px 0;"><span style="background: {color}; color: white; padding: 2px 8px; border-radius: 4px;">{new_status}</span></td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Updated By:</td><td style="padding: 5px 0;">{changed_by}</td></tr>
                    </table>
                </div>
                
                <p style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 12px;">{status_message}</p>
                
                <p style="text-align: center; margin: 20px 0;">
                    <a href="{order_url}" style="display: inline-block; background: {color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Ticket</a>
                </p>
                
                <p style="color: #666; font-size: 12px; margin-top: 20px;">Best regards,<br>Red Ops Team</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email_notification(to_email, subject, body.strip(), html_body)


async def send_ticket_pending_review_email(requester_email: str, requester_name: str, 
                                           resolver_name: str, order_code: str, title: str, order_id: str):
    """Send email when ticket is submitted for review - notify requester"""
    config = get_smtp_config()
    order_url = f"{config['frontend_url']}/orders/{order_id}"
    
    subject = f"[Red Ops] Action Required: Review Ticket {order_code}"
    body = f"""
Hello {requester_name},

Your ticket requires your review!

{resolver_name} has submitted work for your review on ticket {order_code}.

Ticket Details:
- Code: {order_code}
- Title: {title}

Please review the work and respond:
{order_url}

If you're satisfied, you can close the ticket. If changes are needed, send a response.

Best regards,
Red Ops Team
    """
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #8b5cf6; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">⏳ Review Required</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">{order_code}</p>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello <strong>{requester_name}</strong>,</p>
                <p><strong>{resolver_name}</strong> has submitted work for your review.</p>
                
                <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Title:</strong> {title}</p>
                </div>
                
                <p style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 12px;">
                    <strong>Action Required:</strong> Please review the submitted work and respond or close the ticket.
                </p>
                
                <p style="text-align: center; margin: 20px 0;">
                    <a href="{order_url}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Now</a>
                </p>
                
                <p style="color: #666; font-size: 12px; margin-top: 20px;">Best regards,<br>Red Ops Team</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email_notification(requester_email, subject, body.strip(), html_body)


async def send_ticket_reopened_email(to_email: str, to_name: str, reopened_by: str,
                                     order_code: str, title: str, reopen_reason: str, order_id: str):
    """Send email when a ticket is reopened"""
    subject, body = get_email_template("ticket_reopened", {
        "to_name": to_name,
        "reopened_by": reopened_by,
        "order_code": order_code,
        "title": title,
        "reopen_reason": reopen_reason,
        "order_id": order_id
    })
    return await send_email_notification(to_email, subject, body)


async def send_ticket_reassigned_email(to_email: str, to_name: str, from_name: str, to_target: str,
                                       reassigned_by: str, order_code: str, title: str, 
                                       reason: str, order_id: str):
    """Send email when a ticket is reassigned"""
    subject, body = get_email_template("ticket_reassigned", {
        "to_name": to_name,
        "from_name": from_name,
        "to_target": to_target,
        "reassigned_by": reassigned_by,
        "order_code": order_code,
        "title": title,
        "reason": reason or "Not specified",
        "order_id": order_id
    })
    return await send_email_notification(to_email, subject, body)


async def send_ticket_closed_email(requester_email: str, requester_name: str, closed_by: str,
                                   order_code: str, title: str, close_reason: str, order_id: str):
    """Send email when a ticket is closed"""
    config = get_smtp_config()
    order_url = f"{config['frontend_url']}/orders/{order_id}"
    
    subject = f"[Red Ops] Ticket Closed: {order_code}"
    body = f"""
Hello {requester_name},

Your ticket has been closed.

Ticket Details:
- Code: {order_code}
- Title: {title}
- Closed By: {closed_by}
- Reason: {close_reason}

View details: {order_url}

If you need to reopen this ticket, please contact your administrator.

Best regards,
Red Ops Team
    """
    
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #64748b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Ticket Closed</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">{order_code}</p>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello <strong>{requester_name}</strong>,</p>
                <p>Your ticket has been closed.</p>
                
                <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <table style="width: 100%;">
                        <tr><td style="padding: 5px 0; color: #666;">Title:</td><td style="padding: 5px 0;"><strong>{title}</strong></td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Closed By:</td><td style="padding: 5px 0;">{closed_by}</td></tr>
                        <tr><td style="padding: 5px 0; color: #666;">Reason:</td><td style="padding: 5px 0;">{close_reason}</td></tr>
                    </table>
                </div>
                
                <p style="text-align: center; margin: 20px 0;">
                    <a href="{order_url}" style="display: inline-block; background: #64748b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Ticket</a>
                </p>
                
                <p style="color: #666; font-size: 12px; margin-top: 20px;">
                    If you need to reopen this ticket, please contact your administrator.<br><br>
                    Best regards,<br>Red Ops Team
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return await send_email_notification(requester_email, subject, body.strip(), html_body)
