#!/usr/bin/env python3
"""
Category Seeding Script for Red Pulse UAT
Creates comprehensive L1/L2 categories for marketing + real estate organization
Target: 25-30 L1 categories, 250-350 L2 subcategories
"""

import asyncio
import json
import uuid
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# Category definitions with subcategories
CATEGORIES = {
    # ========== MARKETING & CREATIVE ==========
    "Marketing & Creative": {
        "icon": "Palette",
        "subcategories": [
            "Brand Strategy & Guidelines",
            "Campaign Planning",
            "Creative Brief Development",
            "Brand Asset Request",
            "Marketing Collateral",
            "Print Materials",
            "Promotional Items",
            "Signage Request",
            "Logo Usage Request",
            "Brand Approval"
        ]
    },
    "Graphic Design": {
        "icon": "PenTool",
        "subcategories": [
            "Social Media Graphics",
            "Email Graphics",
            "Presentation Design",
            "Infographic Design",
            "Banner Design",
            "Flyer Design",
            "Brochure Design",
            "Business Card Design",
            "Postcard Design",
            "Ad Creative Design",
            "Illustration Request",
            "Icon Design"
        ]
    },
    "Copywriting & Content": {
        "icon": "FileText",
        "subcategories": [
            "Blog Post Writing",
            "Article Writing",
            "Press Release",
            "Email Copy",
            "Landing Page Copy",
            "Ad Copy",
            "Social Media Copy",
            "Product Description",
            "Website Copy",
            "Script Writing",
            "Newsletter Content",
            "Case Study Writing"
        ]
    },
    "Digital Marketing": {
        "icon": "Globe",
        "subcategories": [
            "SEO Strategy",
            "SEO Audit Request",
            "Keyword Research",
            "Link Building Request",
            "Local SEO Setup",
            "Google Business Profile",
            "PPC Campaign Setup",
            "PPC Optimization",
            "Display Advertising",
            "Retargeting Campaign",
            "Analytics Setup",
            "Conversion Tracking"
        ]
    },
    "Social Media": {
        "icon": "Share2",
        "subcategories": [
            "Social Strategy Development",
            "Content Calendar",
            "Post Scheduling",
            "Community Management",
            "Influencer Outreach",
            "Social Ad Campaign",
            "Platform Setup",
            "Social Listening",
            "Engagement Report",
            "Crisis Response"
        ]
    },
    "Email Marketing": {
        "icon": "Mail",
        "subcategories": [
            "Email Campaign Setup",
            "Email Template Design",
            "Newsletter Setup",
            "Drip Campaign Creation",
            "Email List Management",
            "A/B Testing Setup",
            "Email Automation",
            "Deliverability Issue",
            "Unsubscribe Request",
            "Email Analytics"
        ]
    },

    # ========== PRODUCTION & MEDIA ==========
    "Video Production": {
        "icon": "Video",
        "subcategories": [
            "Video Shoot Request",
            "Video Editing",
            "Motion Graphics",
            "Animation Request",
            "Color Correction",
            "Audio Mixing",
            "Subtitles/Captions",
            "Video Thumbnail",
            "YouTube Optimization",
            "Video Compression",
            "Format Conversion",
            "Video Revision",
            "B-Roll Request"
        ]
    },
    "Photography": {
        "icon": "Camera",
        "subcategories": [
            "Photo Shoot Request",
            "Product Photography",
            "Headshot Session",
            "Event Photography",
            "Photo Editing",
            "Photo Retouching",
            "Image Cropping/Resizing",
            "Stock Photo Request",
            "Photo Selection",
            "Photo Archive Access"
        ]
    },
    "Audio & Podcast": {
        "icon": "Mic",
        "subcategories": [
            "Podcast Recording",
            "Audio Editing",
            "Voiceover Recording",
            "Sound Design",
            "Music Licensing",
            "Audio Transcription",
            "Podcast Distribution",
            "Audio Format Conversion"
        ]
    },

    # ========== RESIDENTIAL REAL ESTATE ==========
    "Residential Listings": {
        "icon": "Home",
        "subcategories": [
            "New Listing Setup",
            "Listing Photos Request",
            "Listing Video Request",
            "Virtual Tour Setup",
            "3D Tour/Matterport",
            "Listing Description",
            "MLS Upload",
            "Listing Update",
            "Price Change Request",
            "Listing Status Change",
            "Coming Soon Setup",
            "Pocket Listing Setup"
        ]
    },
    "Residential Sales Support": {
        "icon": "Key",
        "subcategories": [
            "Showing Request",
            "Open House Setup",
            "Open House Materials",
            "Buyer Presentation",
            "Seller Presentation",
            "CMA Request",
            "Market Analysis",
            "Offer Preparation",
            "Counter Offer Support",
            "Contract Review Support",
            "Closing Coordination",
            "Post-Sale Follow-up"
        ]
    },
    "Property Staging": {
        "icon": "Sofa",
        "subcategories": [
            "Staging Consultation",
            "Staging Quote Request",
            "Furniture Rental",
            "Staging Coordination",
            "Destaging Request",
            "Virtual Staging",
            "Staging Photos"
        ]
    },

    # ========== COMMERCIAL REAL ESTATE ==========
    "Commercial Listings": {
        "icon": "Building2",
        "subcategories": [
            "Commercial Listing Setup",
            "Property Information Package",
            "Marketing Package",
            "LoopNet Listing",
            "CoStar Listing",
            "Commercial Photos",
            "Commercial Video",
            "Aerial/Drone Photography",
            "Floor Plan Request",
            "Site Plan Request"
        ]
    },
    "Commercial Leasing": {
        "icon": "FileSignature",
        "subcategories": [
            "Lease Proposal",
            "LOI Preparation",
            "Lease Abstract",
            "Rent Roll Analysis",
            "Tenant Improvement",
            "Lease Renewal",
            "Lease Amendment",
            "Tenant Coordination",
            "Move-In Coordination",
            "Move-Out Coordination"
        ]
    },
    "Commercial Due Diligence": {
        "icon": "ClipboardCheck",
        "subcategories": [
            "Property Condition Report",
            "Environmental Assessment",
            "Survey Request",
            "Title Review",
            "Zoning Analysis",
            "Financial Underwriting",
            "Rent Comp Analysis",
            "Market Study",
            "Investment Memo"
        ]
    },

    # ========== SALES & CRM ==========
    "Sales Operations": {
        "icon": "TrendingUp",
        "subcategories": [
            "Lead Assignment",
            "Lead Routing Setup",
            "Pipeline Report",
            "Sales Forecast",
            "Commission Calculation",
            "Territory Update",
            "Sales Tool Access",
            "CRM Training Request",
            "Sales Collateral",
            "Competitive Analysis"
        ]
    },
    "CRM & Automations": {
        "icon": "Workflow",
        "subcategories": [
            "CRM Data Entry",
            "Contact Import",
            "Contact Merge/Dedupe",
            "Automation Setup",
            "Workflow Creation",
            "Drip Campaign Setup",
            "Task Automation",
            "Notification Setup",
            "Integration Request",
            "CRM Bug Report"
        ]
    },
    "Lead Generation": {
        "icon": "UserPlus",
        "subcategories": [
            "Lead Source Setup",
            "Landing Page Request",
            "Lead Magnet Creation",
            "Webinar Setup",
            "Lead Scoring Setup",
            "Lead Qualification",
            "Lead Nurture Campaign",
            "Referral Program"
        ]
    },

    # ========== CUSTOMER SUPPORT ==========
    "Customer Support": {
        "icon": "Headphones",
        "subcategories": [
            "General Inquiry",
            "Service Complaint",
            "Billing Question",
            "Account Access Issue",
            "Product Question",
            "Feature Request",
            "Bug Report",
            "Escalation Request",
            "Feedback Submission",
            "Survey Response"
        ]
    },
    "Client Services": {
        "icon": "Users",
        "subcategories": [
            "Client Onboarding",
            "Account Setup",
            "Training Request",
            "Service Upgrade",
            "Service Downgrade",
            "Service Cancellation",
            "Contract Renewal",
            "Quarterly Review Request",
            "Success Plan Update"
        ]
    },

    # ========== IT & SYSTEMS ==========
    "IT Support": {
        "icon": "Monitor",
        "subcategories": [
            "Password Reset",
            "Account Lockout",
            "New User Setup",
            "User Deactivation",
            "Email Issue",
            "Software Installation",
            "Software Update",
            "VPN Access",
            "Remote Access Setup",
            "Printer Issue",
            "Network Issue",
            "Internet Connectivity"
        ]
    },
    "Hardware & Devices": {
        "icon": "Laptop",
        "subcategories": [
            "New Laptop Request",
            "Laptop Repair",
            "Monitor Request",
            "Keyboard/Mouse Request",
            "Phone Setup",
            "Tablet Request",
            "Hardware Return",
            "Equipment Inventory",
            "Device Refresh"
        ]
    },
    "Security & Access": {
        "icon": "Shield",
        "subcategories": [
            "Access Request",
            "Permission Change",
            "Security Concern",
            "Suspicious Email Report",
            "Data Breach Report",
            "MFA Setup",
            "Security Training",
            "Security Audit Request",
            "Compliance Check"
        ]
    },

    # ========== FINANCE & ACCOUNTING ==========
    "Accounts Payable": {
        "icon": "CreditCard",
        "subcategories": [
            "Invoice Submission",
            "Invoice Question",
            "Payment Status",
            "Payment Dispute",
            "Vendor Setup",
            "Vendor Update",
            "1099 Request",
            "Check Request",
            "Wire Transfer Request"
        ]
    },
    "Accounts Receivable": {
        "icon": "Receipt",
        "subcategories": [
            "Invoice Request",
            "Payment Received",
            "Collection Follow-up",
            "Credit Memo Request",
            "Refund Request",
            "Statement Request",
            "Payment Plan Setup",
            "Client Billing Issue"
        ]
    },
    "Expense & Reimbursement": {
        "icon": "Wallet",
        "subcategories": [
            "Expense Report",
            "Travel Reimbursement",
            "Mileage Reimbursement",
            "Receipt Missing",
            "Corporate Card Issue",
            "Budget Question",
            "Cost Approval",
            "Petty Cash Request"
        ]
    },
    "Payroll": {
        "icon": "Banknote",
        "subcategories": [
            "Paycheck Question",
            "Direct Deposit Setup",
            "Tax Withholding Change",
            "W-2 Request",
            "Pay Stub Request",
            "Commission Question",
            "Bonus Question",
            "Time Off Balance"
        ]
    },

    # ========== HR & PEOPLE OPS ==========
    "Hiring & Recruiting": {
        "icon": "Briefcase",
        "subcategories": [
            "Job Posting Request",
            "Candidate Referral",
            "Interview Schedule",
            "Offer Letter Request",
            "Background Check",
            "Reference Check",
            "Hiring Manager Support",
            "Job Description Update"
        ]
    },
    "Onboarding": {
        "icon": "UserCheck",
        "subcategories": [
            "New Hire Setup",
            "Equipment Request",
            "System Access Setup",
            "Orientation Schedule",
            "Training Assignment",
            "Benefits Enrollment",
            "I-9 Verification",
            "Badge/Key Request"
        ]
    },
    "Employee Services": {
        "icon": "HeartHandshake",
        "subcategories": [
            "Time Off Request",
            "Leave of Absence",
            "Address Change",
            "Emergency Contact Update",
            "Benefits Question",
            "401k Question",
            "Health Insurance",
            "Life Event Update",
            "Performance Review",
            "Career Development"
        ]
    },
    "Offboarding": {
        "icon": "LogOut",
        "subcategories": [
            "Resignation Processing",
            "Exit Interview",
            "Equipment Return",
            "Access Revocation",
            "Final Paycheck",
            "COBRA Information",
            "Reference Letter Request",
            "Separation Agreement"
        ]
    },

    # ========== LEGAL & COMPLIANCE ==========
    "Contracts & Agreements": {
        "icon": "FileCheck",
        "subcategories": [
            "Contract Review Request",
            "NDA Request",
            "Vendor Agreement",
            "Client Agreement",
            "Employment Agreement",
            "Amendment Request",
            "Contract Renewal",
            "Signature Request",
            "Contract Question"
        ]
    },
    "Compliance & Risk": {
        "icon": "AlertTriangle",
        "subcategories": [
            "Compliance Question",
            "Regulatory Filing",
            "Audit Support",
            "Risk Assessment",
            "Policy Question",
            "Privacy Request",
            "Data Subject Request",
            "Incident Report",
            "Insurance Question"
        ]
    },

    # ========== OPERATIONS & ADMIN ==========
    "Facilities & Office": {
        "icon": "Building",
        "subcategories": [
            "Meeting Room Booking",
            "Desk/Space Request",
            "Parking Request",
            "Building Access",
            "Office Supplies",
            "Furniture Request",
            "Climate Control Issue",
            "Cleaning Request",
            "Maintenance Request",
            "Moving Request"
        ]
    },
    "Procurement": {
        "icon": "ShoppingCart",
        "subcategories": [
            "Purchase Request",
            "Vendor Evaluation",
            "Quote Request",
            "PO Request",
            "Subscription Request",
            "Software Purchase",
            "Equipment Purchase",
            "Service Contract"
        ]
    },

    # ========== CONSTRUCTION & TRADES ==========
    "Roofing & Exterior": {
        "icon": "Warehouse",
        "subcategories": [
            "Roof Inspection",
            "Roof Repair",
            "Roof Replacement",
            "Gutter Cleaning",
            "Gutter Repair",
            "Siding Repair",
            "Exterior Painting",
            "Pressure Washing",
            "Window Replacement",
            "Door Replacement"
        ]
    },
    "Plumbing": {
        "icon": "Droplet",
        "subcategories": [
            "Leak Repair",
            "Drain Cleaning",
            "Water Heater",
            "Toilet Repair",
            "Faucet Repair",
            "Pipe Repair",
            "Sewer Line",
            "Water Pressure Issue",
            "Garbage Disposal",
            "Plumbing Inspection"
        ]
    },
    "Electrical": {
        "icon": "Zap",
        "subcategories": [
            "Electrical Repair",
            "Outlet Installation",
            "Light Fixture",
            "Circuit Breaker",
            "Panel Upgrade",
            "Wiring Issue",
            "Ceiling Fan",
            "Smart Home Install",
            "Electrical Inspection",
            "Generator Service"
        ]
    },
    "HVAC": {
        "icon": "Wind",
        "subcategories": [
            "AC Repair",
            "Heating Repair",
            "HVAC Inspection",
            "Filter Replacement",
            "Thermostat Issue",
            "Duct Cleaning",
            "HVAC Installation",
            "Mini Split Service",
            "Heat Pump Service"
        ]
    },
    "Handyman & General": {
        "icon": "Hammer",
        "subcategories": [
            "General Repair",
            "Drywall Repair",
            "Painting Touch-up",
            "Door Adjustment",
            "Lock Change",
            "Shelf Installation",
            "TV Mounting",
            "Furniture Assembly",
            "Picture Hanging",
            "Caulking/Sealing"
        ]
    },

    # ========== PROJECTS & INITIATIVES ==========
    "Project Requests": {
        "icon": "FolderKanban",
        "subcategories": [
            "New Project Request",
            "Project Scope Change",
            "Resource Request",
            "Budget Request",
            "Timeline Change",
            "Project Status Update",
            "Project Closure",
            "Lessons Learned",
            "Project Documentation"
        ]
    },
    "Process Improvement": {
        "icon": "Settings2",
        "subcategories": [
            "Process Review Request",
            "Automation Request",
            "Template Request",
            "Training Material",
            "Documentation Update",
            "SOP Creation",
            "Workflow Optimization",
            "Tool Evaluation"
        ]
    }
}

async def seed_categories():
    """Seed categories to database"""
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['test_database']
    
    # Clear existing categories (optional - remove if you want to append)
    await db.categories_l1.delete_many({})
    await db.categories_l2.delete_many({})
    print("Cleared existing categories")
    
    # Get existing specialties for potential mapping
    specialties = await db.specialties.find({}).to_list(None)
    specialty_map = {s['name']: s.get('id', str(s['_id'])) for s in specialties}
    
    l1_count = 0
    l2_count = 0
    
    for cat_name, cat_data in CATEGORIES.items():
        # Create L1 category
        l1_id = str(uuid.uuid4())
        l1_doc = {
            "id": l1_id,
            "name": cat_name,
            "icon": cat_data.get("icon", "Folder"),
            "description": f"Category for {cat_name}",
            "translations": {
                "en": cat_name,
                "es": cat_name,  # Would translate in production
                "pt": cat_name
            },
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "enable_workflow": True
        }
        await db.categories_l1.insert_one(l1_doc)
        l1_count += 1
        print(f"Created L1: {cat_name}")
        
        # Create L2 subcategories
        for subcat_name in cat_data.get("subcategories", []):
            l2_id = str(uuid.uuid4())
            l2_doc = {
                "id": l2_id,
                "name": subcat_name,
                "parent_id": l1_id,
                "description": f"Subcategory for {subcat_name}",
                "translations": {
                    "en": subcat_name,
                    "es": subcat_name,
                    "pt": subcat_name
                },
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.categories_l2.insert_one(l2_doc)
            l2_count += 1
    
    print(f"\n{'='*60}")
    print(f"SEEDING COMPLETE")
    print(f"  L1 Categories: {l1_count}")
    print(f"  L2 Subcategories: {l2_count}")
    print(f"  Total: {l1_count + l2_count}")
    print(f"{'='*60}")
    
    # Export to JSON
    export_dir = "/app/backups/category_seed"
    os.makedirs(export_dir, exist_ok=True)
    
    l1_docs = await db.categories_l1.find({}, {"_id": 0}).to_list(None)
    l2_docs = await db.categories_l2.find({}, {"_id": 0}).to_list(None)
    
    with open(f"{export_dir}/categories_l1.json", 'w') as f:
        json.dump(l1_docs, f, indent=2)
    
    with open(f"{export_dir}/categories_l2.json", 'w') as f:
        json.dump(l2_docs, f, indent=2)
    
    # Combined export
    combined = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "l1_count": l1_count,
        "l2_count": l2_count,
        "categories_l1": l1_docs,
        "categories_l2": l2_docs
    }
    with open(f"{export_dir}/categories_full.json", 'w') as f:
        json.dump(combined, f, indent=2)
    
    print(f"\nExported to: {export_dir}/")
    print(f"  - categories_l1.json")
    print(f"  - categories_l2.json")
    print(f"  - categories_full.json")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_categories())
