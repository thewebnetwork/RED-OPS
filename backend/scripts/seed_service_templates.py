"""
Seed script for the 9 frozen MVP service templates.
Run: python scripts/seed_service_templates.py
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

TEMPLATES = [
    {
        "id": "video-editing-60s",
        "name": "Video Editing 60s Reels",
        "description": "Professional 60-second video editing for Instagram Reels, TikTok, and YouTube Shorts",
        "client_visible": True,
        "icon": "video",
        "default_title": "Video Editing - 60s Reels",
        "hidden_category_l1": "Video Production",
        "hidden_category_l2": None,
        "form_schema": [
            {"field": "footage_links", "label": "Footage Link(s)", "type": "textarea", "required": True, "placeholder": "Paste Google Drive, Dropbox, or WeTransfer links to your raw footage"},
            {"field": "platform", "label": "Platform", "type": "select", "required": True, "options": ["Instagram Reels", "TikTok", "YouTube Shorts", "Multiple Platforms"]},
            {"field": "goal", "label": "Goal / Desired Outcome", "type": "textarea", "required": True, "placeholder": "What should this video achieve? (e.g., drive engagement, promote a product, educate)"},
            {"field": "reference_links", "label": "Reference Links", "type": "textarea", "required": False, "placeholder": "Links to videos or styles you like as reference"},
            {"field": "captions", "label": "Captions", "type": "select", "required": True, "options": ["Yes", "No"], "default_value": "Yes"},
            {"field": "hook_script", "label": "Hook or Script", "type": "textarea", "required": False, "placeholder": "Opening hook, voiceover text, or full script if available"},
            {"field": "priority", "label": "Priority", "type": "select", "required": True, "options": ["Low", "Normal", "High", "Urgent"], "default_value": "Normal"},
            {"field": "deadline", "label": "Deadline", "type": "date", "required": False},
            {"field": "special_notes", "label": "Special Notes", "type": "textarea", "required": False, "placeholder": "Any other details, brand guidelines, or specific requests"}
        ],
        "required_fields": ["footage_links", "platform", "goal", "captions", "priority"],
        "default_task_templates": [
            {"title": "Review raw footage", "assignee_type": "internal", "visibility": "internal", "default_status": "todo"},
            {"title": "First cut edit", "assignee_type": "internal", "visibility": "internal", "default_status": "backlog"},
            {"title": "Review and approve edit", "assignee_type": "client", "visibility": "client", "default_status": "backlog"}
        ],
        "turnaround_text": "3-5 days",
        "deliverable_type": "video",
        "active": True,
        "sort_order": 1
    },
    {
        "id": "story-editing",
        "name": "Story Editing",
        "description": "Instagram Stories and short vertical content — quick edits optimized for engagement",
        "client_visible": True,
        "icon": "video",
        "default_title": "Story Editing",
        "hidden_category_l1": "Video Production",
        "hidden_category_l2": None,
        "form_schema": [
            {"field": "footage_links", "label": "Footage Link(s)", "type": "textarea", "required": True, "placeholder": "Paste links to your raw footage or clips"},
            {"field": "platform", "label": "Platform", "type": "select", "required": True, "options": ["Instagram Stories", "Facebook Stories", "TikTok Stories", "Multiple"]},
            {"field": "number_of_stories", "label": "Number of Stories", "type": "select", "required": True, "options": ["1-3", "4-6", "7-10", "10+"]},
            {"field": "goal", "label": "Goal / Desired Outcome", "type": "textarea", "required": False, "placeholder": "What should these stories communicate?"},
            {"field": "captions", "label": "Captions / Text Overlays", "type": "select", "required": True, "options": ["Yes", "No"], "default_value": "Yes"},
            {"field": "music_preference", "label": "Music Preference", "type": "text", "required": False, "placeholder": "Upbeat, trending audio, specific track link..."},
            {"field": "priority", "label": "Priority", "type": "select", "required": True, "options": ["Low", "Normal", "High", "Urgent"], "default_value": "Normal"},
            {"field": "deadline", "label": "Deadline", "type": "date", "required": False},
            {"field": "special_notes", "label": "Special Notes", "type": "textarea", "required": False, "placeholder": "Branding requirements, CTA, sticker preferences, etc."}
        ],
        "required_fields": ["footage_links", "platform", "number_of_stories", "captions", "priority"],
        "default_task_templates": [
            {"title": "Review story assets", "assignee_type": "internal", "visibility": "internal", "default_status": "todo"},
            {"title": "Edit stories", "assignee_type": "internal", "visibility": "internal", "default_status": "backlog"},
            {"title": "Review and approve stories", "assignee_type": "client", "visibility": "client", "default_status": "backlog"}
        ],
        "turnaround_text": "1-2 days",
        "deliverable_type": "video",
        "active": True,
        "sort_order": 2
    },
    {
        "id": "long-form-video",
        "name": "Long Form Video Editing",
        "description": "Complete video editing for longer content — promos, brand videos, and presentations",
        "client_visible": True,
        "icon": "video",
        "default_title": "Long Form Video Editing",
        "hidden_category_l1": "Video Production",
        "hidden_category_l2": None,
        "form_schema": [
            {"field": "footage_links", "label": "Footage Link(s)", "type": "textarea", "required": True, "placeholder": "Paste Google Drive, Dropbox, or WeTransfer links"},
            {"field": "video_length", "label": "Target Video Length", "type": "select", "required": True, "options": ["2-5 minutes", "5-10 minutes", "10-15 minutes", "Other"]},
            {"field": "purpose", "label": "Video Purpose", "type": "textarea", "required": True, "placeholder": "What is this video for? (e.g., brand promo, training, event recap)"},
            {"field": "reference_links", "label": "Reference Links", "type": "textarea", "required": False, "placeholder": "Links to example videos or style references"},
            {"field": "captions", "label": "Captions", "type": "select", "required": True, "options": ["Yes", "No"], "default_value": "Yes"},
            {"field": "music_preference", "label": "Music / Audio Direction", "type": "textarea", "required": False, "placeholder": "Music style, voiceover needs, specific tracks..."},
            {"field": "priority", "label": "Priority", "type": "select", "required": True, "options": ["Low", "Normal", "High", "Urgent"], "default_value": "Normal"},
            {"field": "deadline", "label": "Deadline", "type": "date", "required": False},
            {"field": "special_notes", "label": "Special Notes", "type": "textarea", "required": False, "placeholder": "Intro/outro requirements, color grading preferences, etc."}
        ],
        "required_fields": ["footage_links", "video_length", "purpose", "captions", "priority"],
        "default_task_templates": [
            {"title": "Review footage and brief", "assignee_type": "internal", "visibility": "internal", "default_status": "todo"},
            {"title": "Assembly cut", "assignee_type": "internal", "visibility": "internal", "default_status": "backlog"},
            {"title": "Review first cut", "assignee_type": "client", "visibility": "client", "default_status": "backlog"}
        ],
        "turnaround_text": "5-7 days",
        "deliverable_type": "video",
        "active": True,
        "sort_order": 3
    },
    {
        "id": "youtube-long-form",
        "name": "YouTube Long Form Editing 15 to 30 Minutes",
        "description": "Complete YouTube video editing with intro, outro, b-roll, transitions, chapters, and retention optimization",
        "client_visible": True,
        "icon": "video",
        "default_title": "YouTube Long Form Editing",
        "hidden_category_l1": "Video Production",
        "hidden_category_l2": None,
        "form_schema": [
            {"field": "footage_links", "label": "Footage Link(s)", "type": "textarea", "required": True, "placeholder": "Paste Google Drive, Dropbox, or WeTransfer links to all footage"},
            {"field": "video_length_target", "label": "Video Length Target", "type": "select", "required": True, "options": ["15-20 minutes", "20-25 minutes", "25-30 minutes"]},
            {"field": "youtube_title_topic", "label": "YouTube Title / Topic", "type": "text", "required": True, "placeholder": "What is the video title or main topic?"},
            {"field": "audience_goal", "label": "Audience / Goal", "type": "textarea", "required": True, "placeholder": "Who is the audience and what should the video achieve?"},
            {"field": "cta_offer", "label": "CTA or Offer Mention", "type": "textarea", "required": False, "placeholder": "Any call-to-action, product mention, or sponsor segment to include?"},
            {"field": "reference_links", "label": "Reference Examples", "type": "textarea", "required": False, "placeholder": "Links to YouTube videos with a similar style you like"},
            {"field": "chapter_markers", "label": "Chapter Markers", "type": "select", "required": True, "options": ["Yes", "No"], "default_value": "Yes"},
            {"field": "captions", "label": "Captions", "type": "select", "required": True, "options": ["Yes", "No"], "default_value": "Yes"},
            {"field": "thumbnail_needed", "label": "Thumbnail Needed", "type": "select", "required": True, "options": ["Yes", "No"], "default_value": "Yes"},
            {"field": "priority", "label": "Priority", "type": "select", "required": True, "options": ["Low", "Normal", "High", "Urgent"], "default_value": "Normal"},
            {"field": "deadline", "label": "Deadline", "type": "date", "required": False},
            {"field": "special_notes", "label": "Special Notes", "type": "textarea", "required": False, "placeholder": "Intro/outro style, color grading, pacing preferences, etc."}
        ],
        "required_fields": ["footage_links", "video_length_target", "youtube_title_topic", "audience_goal", "chapter_markers", "captions", "thumbnail_needed", "priority"],
        "default_task_templates": [
            {"title": "Review footage and brief", "assignee_type": "internal", "visibility": "internal", "default_status": "todo"},
            {"title": "Assembly cut with chapters", "assignee_type": "internal", "visibility": "internal", "default_status": "backlog"},
            {"title": "Create thumbnail", "assignee_type": "internal", "visibility": "internal", "default_status": "backlog"},
            {"title": "Review first cut", "assignee_type": "client", "visibility": "client", "default_status": "backlog"},
            {"title": "Final review before publish", "assignee_type": "client", "visibility": "client", "default_status": "backlog"}
        ],
        "turnaround_text": "7-10 days",
        "deliverable_type": "video",
        "active": True,
        "sort_order": 4
    },
    {
        "id": "thumbnail-design",
        "name": "Thumbnail Design",
        "description": "Eye-catching YouTube thumbnails and social media preview images designed for clicks",
        "client_visible": True,
        "icon": "image",
        "default_title": "Thumbnail Design",
        "hidden_category_l1": "Graphic Design",
        "hidden_category_l2": None,
        "form_schema": [
            {"field": "platform", "label": "Platform", "type": "select", "required": True, "options": ["YouTube", "Instagram", "Facebook", "LinkedIn", "Other"]},
            {"field": "video_topic", "label": "Video / Content Topic", "type": "text", "required": True, "placeholder": "What is the video or content about?"},
            {"field": "text_overlay", "label": "Text to Include on Thumbnail", "type": "text", "required": False, "placeholder": "Main text, tagline, or number to display"},
            {"field": "reference_links", "label": "Reference Images / Links", "type": "textarea", "required": False, "placeholder": "Links to thumbnails or styles you like"},
            {"field": "brand_assets", "label": "Brand Assets Link", "type": "text", "required": False, "placeholder": "Link to logo, fonts, or brand kit"},
            {"field": "face_photo_link", "label": "Face Photo / Headshot Link", "type": "text", "required": False, "placeholder": "Link to your headshot if needed for thumbnail"},
            {"field": "style_preference", "label": "Style Preference", "type": "select", "required": False, "options": ["Bold & Colorful", "Clean & Minimal", "Dark & Dramatic", "Fun & Playful", "No Preference"]},
            {"field": "number_of_options", "label": "Number of Options", "type": "select", "required": True, "options": ["1", "2", "3"], "default_value": "2"},
            {"field": "priority", "label": "Priority", "type": "select", "required": True, "options": ["Low", "Normal", "High", "Urgent"], "default_value": "Normal"},
            {"field": "deadline", "label": "Deadline", "type": "date", "required": False},
            {"field": "special_notes", "label": "Special Notes", "type": "textarea", "required": False, "placeholder": "Any specific requests, colors to use/avoid, etc."}
        ],
        "required_fields": ["platform", "video_topic", "number_of_options", "priority"],
        "default_task_templates": [
            {"title": "Design thumbnail options", "assignee_type": "internal", "visibility": "internal", "default_status": "todo"},
            {"title": "Review and select thumbnail", "assignee_type": "client", "visibility": "client", "default_status": "backlog"}
        ],
        "turnaround_text": "1-2 days",
        "deliverable_type": "image",
        "active": True,
        "sort_order": 5
    },
    {
        "id": "social-media-graphics",
        "name": "Social Media Graphics",
        "description": "Custom graphics for Instagram, Facebook, LinkedIn, and Twitter posts",
        "client_visible": True,
        "icon": "design",
        "default_title": "Social Media Graphics",
        "hidden_category_l1": "Graphic Design",
        "hidden_category_l2": None,
        "form_schema": [
            {"field": "platforms", "label": "Platforms", "type": "select", "required": True, "options": ["Instagram", "Facebook", "LinkedIn", "Twitter/X", "Multiple Platforms"]},
            {"field": "content_type", "label": "Content Type", "type": "select", "required": True, "options": ["Single Post", "Carousel", "Banner/Cover", "Ad Creative", "Infographic"]},
            {"field": "topic_message", "label": "Topic / Message", "type": "textarea", "required": True, "placeholder": "What should the graphic communicate?"},
            {"field": "text_copy", "label": "Text / Copy for Graphic", "type": "textarea", "required": False, "placeholder": "Exact text, headlines, or bullet points to include"},
            {"field": "brand_assets", "label": "Brand Assets Link", "type": "text", "required": False, "placeholder": "Link to logo, fonts, brand kit, or images"},
            {"field": "reference_links", "label": "Reference / Inspiration", "type": "textarea", "required": False, "placeholder": "Links to designs or styles you like"},
            {"field": "number_of_designs", "label": "Number of Designs", "type": "select", "required": True, "options": ["1", "2-3", "4-5", "6+"], "default_value": "1"},
            {"field": "priority", "label": "Priority", "type": "select", "required": True, "options": ["Low", "Normal", "High", "Urgent"], "default_value": "Normal"},
            {"field": "deadline", "label": "Deadline", "type": "date", "required": False},
            {"field": "special_notes", "label": "Special Notes", "type": "textarea", "required": False, "placeholder": "Specific dimensions, colors, or other requirements"}
        ],
        "required_fields": ["platforms", "content_type", "topic_message", "number_of_designs", "priority"],
        "default_task_templates": [
            {"title": "Create graphic designs", "assignee_type": "internal", "visibility": "internal", "default_status": "todo"},
            {"title": "Review and approve designs", "assignee_type": "client", "visibility": "client", "default_status": "backlog"}
        ],
        "turnaround_text": "2-4 days",
        "deliverable_type": "image",
        "active": True,
        "sort_order": 6
    },
    {
        "id": "content-writing",
        "name": "Content Writing",
        "description": "Blog posts, captions, scripts, and web copy tailored to your brand voice",
        "client_visible": True,
        "icon": "content",
        "default_title": "Content Writing",
        "hidden_category_l1": "Copywriting & Content",
        "hidden_category_l2": None,
        "form_schema": [
            {"field": "content_type", "label": "Content Type", "type": "select", "required": True, "options": ["Blog Post", "Social Media Captions", "Video Script", "Website Copy", "Email Copy", "Ad Copy", "Other"]},
            {"field": "topic", "label": "Topic / Subject", "type": "textarea", "required": True, "placeholder": "What should the content be about?"},
            {"field": "target_audience", "label": "Target Audience", "type": "text", "required": True, "placeholder": "Who is this content for?"},
            {"field": "tone", "label": "Tone / Voice", "type": "select", "required": False, "options": ["Professional", "Casual & Friendly", "Bold & Direct", "Educational", "Inspirational", "Humorous", "Match Existing Brand Voice"]},
            {"field": "word_count", "label": "Word Count / Length", "type": "select", "required": False, "options": ["Short (under 300 words)", "Medium (300-800 words)", "Long (800-1500 words)", "Long-form (1500+ words)"]},
            {"field": "key_points", "label": "Key Points to Cover", "type": "textarea", "required": False, "placeholder": "List the main points, keywords, or messaging pillars"},
            {"field": "reference_links", "label": "Reference / Examples", "type": "textarea", "required": False, "placeholder": "Links to content style or examples you want to match"},
            {"field": "cta", "label": "Call to Action", "type": "text", "required": False, "placeholder": "What should the reader do after consuming this content?"},
            {"field": "priority", "label": "Priority", "type": "select", "required": True, "options": ["Low", "Normal", "High", "Urgent"], "default_value": "Normal"},
            {"field": "deadline", "label": "Deadline", "type": "date", "required": False},
            {"field": "special_notes", "label": "Special Notes", "type": "textarea", "required": False, "placeholder": "SEO keywords, brand guidelines, formatting requirements, etc."}
        ],
        "required_fields": ["content_type", "topic", "target_audience", "priority"],
        "default_task_templates": [
            {"title": "Write first draft", "assignee_type": "internal", "visibility": "internal", "default_status": "todo"},
            {"title": "Review and approve content", "assignee_type": "client", "visibility": "client", "default_status": "backlog"}
        ],
        "turnaround_text": "2-3 days",
        "deliverable_type": "document",
        "active": True,
        "sort_order": 7
    },
    {
        "id": "email-campaigns",
        "name": "Email Campaign Support",
        "description": "Email newsletter design, copywriting, and campaign setup for audience engagement",
        "client_visible": True,
        "icon": "marketing",
        "default_title": "Email Campaign Support",
        "hidden_category_l1": "Email Marketing",
        "hidden_category_l2": None,
        "form_schema": [
            {"field": "campaign_type", "label": "Campaign Type", "type": "select", "required": True, "options": ["Newsletter", "Promotional", "Welcome Sequence", "Product Launch", "Re-engagement", "Other"]},
            {"field": "goal", "label": "Campaign Goal", "type": "textarea", "required": True, "placeholder": "What is the goal of this email campaign?"},
            {"field": "audience", "label": "Target Audience / List", "type": "text", "required": True, "placeholder": "Who should receive this? (e.g., all subscribers, segment name)"},
            {"field": "key_message", "label": "Key Message / Offer", "type": "textarea", "required": True, "placeholder": "Main message, offer, or announcement"},
            {"field": "cta", "label": "Call to Action", "type": "text", "required": False, "placeholder": "What should the reader click or do?"},
            {"field": "brand_assets", "label": "Brand Assets / Images Link", "type": "text", "required": False, "placeholder": "Link to logos, product images, brand kit"},
            {"field": "reference_links", "label": "Reference Emails", "type": "textarea", "required": False, "placeholder": "Links or screenshots of email styles you like"},
            {"field": "email_platform", "label": "Email Platform", "type": "select", "required": False, "options": ["Mailchimp", "ActiveCampaign", "HubSpot", "GoHighLevel", "Klaviyo", "Other"]},
            {"field": "priority", "label": "Priority", "type": "select", "required": True, "options": ["Low", "Normal", "High", "Urgent"], "default_value": "Normal"},
            {"field": "deadline", "label": "Send Date / Deadline", "type": "date", "required": False},
            {"field": "special_notes", "label": "Special Notes", "type": "textarea", "required": False, "placeholder": "A/B testing needs, specific sections, personalization requirements"}
        ],
        "required_fields": ["campaign_type", "goal", "audience", "key_message", "priority"],
        "default_task_templates": [
            {"title": "Draft email copy", "assignee_type": "internal", "visibility": "internal", "default_status": "todo"},
            {"title": "Design email template", "assignee_type": "internal", "visibility": "internal", "default_status": "backlog"},
            {"title": "Review and approve email", "assignee_type": "client", "visibility": "client", "default_status": "backlog"}
        ],
        "turnaround_text": "2-3 days",
        "deliverable_type": "document",
        "active": True,
        "sort_order": 8
    },
    {
        "id": "website-updates",
        "name": "Website Updates",
        "description": "Minor website updates, content changes, page edits, and small fixes",
        "client_visible": True,
        "icon": "web",
        "default_title": "Website Update",
        "hidden_category_l1": "CRM & Automations",
        "hidden_category_l2": None,
        "form_schema": [
            {"field": "update_type", "label": "Update Type", "type": "select", "required": True, "options": ["Text / Content Change", "Image Replacement", "New Page / Section", "Bug Fix", "Design Tweak", "Other"]},
            {"field": "page_url", "label": "Page URL", "type": "text", "required": True, "placeholder": "https://yoursite.com/page-to-update"},
            {"field": "description", "label": "What Needs to Change", "type": "textarea", "required": True, "placeholder": "Describe exactly what needs to be updated or changed"},
            {"field": "new_content", "label": "New Content / Text", "type": "textarea", "required": False, "placeholder": "Paste the new text, copy, or content here"},
            {"field": "reference_links", "label": "Screenshots / Reference Links", "type": "textarea", "required": False, "placeholder": "Links to screenshots showing what needs to change"},
            {"field": "assets_link", "label": "Assets Link", "type": "text", "required": False, "placeholder": "Link to new images, files, or assets to use"},
            {"field": "website_platform", "label": "Website Platform", "type": "select", "required": False, "options": ["WordPress", "Shopify", "Wix", "Squarespace", "Custom / Other", "Not Sure"]},
            {"field": "login_access", "label": "Login / Access Details", "type": "textarea", "required": False, "placeholder": "How should the team access the website? (credentials shared securely)"},
            {"field": "priority", "label": "Priority", "type": "select", "required": True, "options": ["Low", "Normal", "High", "Urgent"], "default_value": "Normal"},
            {"field": "deadline", "label": "Deadline", "type": "date", "required": False},
            {"field": "special_notes", "label": "Special Notes", "type": "textarea", "required": False, "placeholder": "Any other details or specific requirements"}
        ],
        "required_fields": ["update_type", "page_url", "description", "priority"],
        "default_task_templates": [
            {"title": "Review update request", "assignee_type": "internal", "visibility": "internal", "default_status": "todo"},
            {"title": "Implement changes", "assignee_type": "internal", "visibility": "internal", "default_status": "backlog"},
            {"title": "Review and confirm update", "assignee_type": "client", "visibility": "client", "default_status": "backlog"}
        ],
        "turnaround_text": "1-3 days",
        "deliverable_type": "website",
        "active": True,
        "sort_order": 9
    }
]


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    for template in TEMPLATES:
        existing = await db.service_templates.find_one({"id": template["id"]})
        if existing:
            # Update existing template
            await db.service_templates.replace_one({"id": template["id"]}, template)
            print(f"  Updated: {template['name']}")
        else:
            await db.service_templates.insert_one(template)
            print(f"  Created: {template['name']}")

    print(f"\nSeeded {len(TEMPLATES)} service templates.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
