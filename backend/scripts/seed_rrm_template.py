"""
RRM Media Client — 4-Month Engagement Template
32 tasks across 7 phases, mapped from RRM SOPs.
"""

RRM_MEDIA_CLIENT_TEMPLATE = {
    "id": "rrm-media-client-template-v1",
    "is_global": True,
    "org_id": None,
    "name": "RRM Media Client — 4-Month Engagement",
    "description": "Full delivery flow for Canadian realtor clients. Covers kickoff through renewal.",
    "offer_type": "rrm_media_client",
    "type": "engagement",
    "trigger": "rrm_media_client",
    "icon": "🤝",
    "phases": ["Kickoff & Onboarding", "Build", "Launch", "Month 1", "Month 2", "Month 3", "Month 4 & Renewal"],
    "tasks": [
        # ── PHASE: Kickoff & Onboarding (Day 0–5) ──
        {"title": "Send Welcome Email", "phase": "Kickoff & Onboarding", "day_offset": 0, "assignee_role": "account_manager", "sop_reference": "SOP 01 — Welcome Email", "is_client_visible": False, "checklist": ["Replace all [PLACEHOLDERS]", "Add GHL onboarding form link", "Add WhatsApp group"]},
        {"title": "Send Onboarding Instructions", "phase": "Kickoff & Onboarding", "day_offset": 0, "assignee_role": "account_manager", "sop_reference": "SOP 02 — Client Onboarding Instructions", "checklist": ["Send doc via email or WhatsApp"]},
        {"title": "Send FAQ Doc", "phase": "Kickoff & Onboarding", "day_offset": 0, "assignee_role": "account_manager", "sop_reference": "SOP 03 — FAQ", "checklist": ["Send FAQ to client WhatsApp group"]},
        {"title": "Create WhatsApp Group", "phase": "Kickoff & Onboarding", "day_offset": 0, "assignee_role": "account_manager", "checklist": ["Add client", "Add Vitto", "Add Lucca", "Pin onboarding instructions"]},
        {"title": "Confirm Contract Signed + Payment Received", "phase": "Kickoff & Onboarding", "day_offset": 0, "assignee_role": "account_manager", "sop_reference": "SOP 30 — Contract & Payment Setup", "checklist": ["Contract signed", "PIF confirmed ($3,500)", "Move to Closed Won in GHL", "GHL automation fires"]},
        {"title": "Schedule & Complete Kickoff Call (KOM)", "phase": "Kickoff & Onboarding", "day_offset": 2, "assignee_role": "account_manager", "sop_reference": "SOP 05 — Kickoff Call (A.L.I.G.N.)", "is_client_visible": True, "checklist": ["Review sales notes before call", "A — Acknowledge: reference why they bought", "L — Lock Pain: confirm core problem", "I — Identify Outcome: define measurable success", "G — Gather Inputs: collect all missing assets", "N — Next Steps: confirm build path", "Post-call: send WhatsApp recap", "Post-call: assign build tasks to Lucca", "Post-call: update client record"]},
        {"title": "Collect All Client Assets", "phase": "Kickoff & Onboarding", "day_offset": 3, "assignee_role": "account_manager", "is_client_visible": True, "checklist": ["Professional headshot", "Brokerage logo (PNG transparent)", "Bio / About text (first person, 2 paragraphs)", "Brokerage branding guidelines", "Facebook Page admin access", "Meta Business Manager / Ad Account partner access", "Google Calendar booking link", "Testimonials or proof assets", "Thank-you page video filmed (or script sent)"]},

        # ── PHASE: Build (Day 5–12) ──
        {"title": "GHL Sub-Account Setup", "phase": "Build", "day_offset": 5, "assignee_role": "operator", "sop_reference": "SOP 10 — GHL Build (16-Step)", "checklist": ["Create sub-account", "Apply client branding", "Install Meta Pixel", "Load client assets (logo, headshot, bio)", "Configure 5 automations (Speed-to-Lead, nurture, long-term follow-up)", "Configure Google Calendar booking integration", "QA all automations", "Record Loom walkthrough for client"]},
        {"title": "Build Landing Page", "phase": "Build", "day_offset": 5, "assignee_role": "operator", "sop_reference": "SOP 12 — Landing Page Build", "checklist": ["Hero section with matching headline", "Trust section (testimonials if available)", "Value proposition (3-5 bullets)", "About agent section", "Lead form: Name, Email, Phone + 4-question survey", "Thank-you page with video (or fallback image)", "Calendar widget on thank-you page", "Brokerage logo visible (Canadian legal requirement)", "Mobile-first design confirmed", "Domain + DNS configured"]},
        {"title": "Build Meta Campaign", "phase": "Build", "day_offset": 7, "assignee_role": "operator", "sop_reference": "SOP 11 — Meta Campaign Setup", "checklist": ["Campaign objective: Leads", "Housing category ON (required in Canada)", "4 ad sets × $7.50 = $30/day minimum", "Instant form: Higher Intent, 4 survey questions", "6+ creative angles prepared (from SOP 06)", "UTM parameters configured", "Pixel events verified firing", "CASL-compliant copy (brokerage logo in creative)"]},
        {"title": "Pre-Launch QA", "phase": "Build", "day_offset": 10, "assignee_role": "operator", "checklist": ["Test lead form submission end-to-end", "Confirm lead lands in GHL CRM", "Confirm Speed-to-Lead SMS fires within 5 min", "Confirm booking link works", "Confirm thank-you page loads with video", "Confirm all ad sets approved by Meta"]},

        # ── PHASE: Launch (Day 12–14) ──
        {"title": "Complete Launch Call", "phase": "Launch", "day_offset": 12, "assignee_role": "account_manager", "sop_reference": "SOP 09 — Launch Call", "is_client_visible": True, "checklist": ["Set expectations BEFORE showing ads", "Explain testing phase (no panic in first 2 weeks)", "Re-anchor real goal: booked appointments, not just leads", "Explain client role (answer calls, follow up, be present)", "Explain communication cadence (bi-weekly calls, WhatsApp updates)", "Walk through the full campaign", "Get launch approval", "Collect any final revisions"]},
        {"title": "Go Live — Activate Campaign", "phase": "Launch", "day_offset": 14, "assignee_role": "operator", "checklist": ["Turn on all ad sets", "Monitor at 30 min post-launch", "Monitor at 4 hours post-launch", "Monitor at 24 hours post-launch", "Monitor at 48 hours post-launch", "Activate ISA", "Notify client in WhatsApp: campaign is live"]},

        # ── PHASE: Month 1 ──
        {"title": "Week 1 — Monitor Only (No Changes)", "phase": "Month 1", "day_offset": 14, "assignee_role": "operator", "sop_reference": "SOP 13 — Go-Live Weeks 1-4", "checklist": ["Daily health check", "Log all metrics", "Do NOT make changes", "Check speed-to-lead daily"]},
        {"title": "Week 2 — First Data Review", "phase": "Month 1", "day_offset": 21, "assignee_role": "operator", "sop_reference": "SOP 13 — Go-Live Weeks 1-4", "checklist": ["Run Green/Yellow/Red assessment", "Identify optimization priority", "Log decision in client tracker"]},
        {"title": "Bi-Weekly Check-In Call #1", "phase": "Month 1", "day_offset": 21, "assignee_role": "account_manager", "sop_reference": "SOP 15 — Client Check-In Call", "is_client_visible": True, "checklist": ["Review tracker pre-call", "Check health score (1-30 scale)", "Lead with positives", "Share what's working + what's adjusting", "Confirm next steps", "Log churn risk signals if any"]},
        {"title": "Week 3 — Optimize Based on Status", "phase": "Month 1", "day_offset": 28, "assignee_role": "operator", "sop_reference": "SOP 14 — D.A.T.A. Optimization", "checklist": ["Diagnose bottleneck layer", "Make one high-leverage change", "Log change + reason", "Alert client if relevant"]},
        {"title": "Bi-Weekly Check-In Call #2", "phase": "Month 1", "day_offset": 35, "assignee_role": "account_manager", "sop_reference": "SOP 15 — Client Check-In Call", "is_client_visible": True, "checklist": ["Pre-call review", "Performance update", "Next steps"]},
        {"title": "Month 1 Performance Report", "phase": "Month 1", "day_offset": 42, "assignee_role": "account_manager", "sop_reference": "SOP 16 — Client Reporting Template", "is_client_visible": True, "checklist": ["Total spend", "Total leads", "CPL", "Booked appointments", "Show rate", "What worked", "What we're improving", "Next month plan"]},

        # ── PHASE: Month 2 ──
        {"title": "Bi-Weekly Check-In Call #3", "phase": "Month 2", "day_offset": 49, "assignee_role": "account_manager", "sop_reference": "SOP 15 — Client Check-In Call", "is_client_visible": True, "checklist": ["Pre-call review", "Performance update", "Collect early testimonial if results exist"]},
        {"title": "Creative Refresh Review", "phase": "Month 2", "day_offset": 56, "assignee_role": "operator", "sop_reference": "SOP 24 — Creative Refresh (70/20/10)", "checklist": ["Classify all creatives: Winner / Promising / Underperforming / Dead", "70% budget → winner variations", "20% → new variations of proven angles", "10% → completely new angles", "Check frequency (pause if >3.0)", "Check CTR decline + CPL increase"]},
        {"title": "Bi-Weekly Check-In Call #4", "phase": "Month 2", "day_offset": 63, "assignee_role": "account_manager", "sop_reference": "SOP 15 — Client Check-In Call", "is_client_visible": True, "checklist": ["Pre-call review", "Performance update", "Next steps"]},
        {"title": "Month 2 Performance Report", "phase": "Month 2", "day_offset": 72, "assignee_role": "account_manager", "sop_reference": "SOP 16 — Client Reporting Template", "is_client_visible": True, "checklist": ["Full report + Month 3 plan"]},
        {"title": "Request Testimonial", "phase": "Month 2", "day_offset": 72, "assignee_role": "account_manager", "sop_reference": "SOP 26 — Testimonial & Case Study", "checklist": ["Screenshot proof", "Written 2-3 sentences", "Video testimonial (optional, 60 sec)"]},

        # ── PHASE: Month 3 ──
        {"title": "Bi-Weekly Check-In Call #5", "phase": "Month 3", "day_offset": 77, "assignee_role": "account_manager", "sop_reference": "SOP 15 — Client Check-In Call", "is_client_visible": True, "checklist": ["Pre-call review", "Performance update", "Begin renewal prep internally"]},
        {"title": "Second Creative Refresh", "phase": "Month 3", "day_offset": 84, "assignee_role": "operator", "sop_reference": "SOP 24 — Creative Refresh (70/20/10)", "checklist": ["Re-classify all creatives", "Refresh 70/20/10", "New angles based on Month 2 data"]},
        {"title": "Bi-Weekly Check-In Call #6", "phase": "Month 3", "day_offset": 91, "assignee_role": "account_manager", "sop_reference": "SOP 15 — Client Check-In Call", "is_client_visible": True, "checklist": ["Pre-call review", "Discuss renewal options informally"]},
        {"title": "Month 3 Performance Report", "phase": "Month 3", "day_offset": 100, "assignee_role": "account_manager", "sop_reference": "SOP 16 — Client Reporting Template", "is_client_visible": True, "checklist": ["Full report + Month 4 plan + renewal context"]},

        # ── PHASE: Month 4 & Renewal ──
        {"title": "Schedule Renewal Call (R.E.N.E.W.)", "phase": "Month 4 & Renewal", "day_offset": 105, "assignee_role": "account_manager", "sop_reference": "SOP 17 — SCP Renewal Call", "checklist": ["Send pre-call email asking what felt valuable", "Ask what to improve", "Ask for specific concerns"]},
        {"title": "Complete Renewal Call", "phase": "Month 4 & Renewal", "day_offset": 110, "assignee_role": "account_manager", "sop_reference": "SOP 17 — R.E.N.E.W. Framework", "is_client_visible": True, "checklist": ["R — Review: what happened over 4 months", "E — Expose Gap: what's left to solve", "N — Next Plan: present 3 options", "E — Enroll or Exit: get the decision", "W — Wrap: lock next steps", "Log decision in CRM"]},
        {"title": "Month 4 Final Report", "phase": "Month 4 & Renewal", "day_offset": 118, "assignee_role": "account_manager", "sop_reference": "SOP 16 — Client Reporting Template", "is_client_visible": True, "checklist": ["Final performance summary", "ROI summary", "Renewal or offboarding path confirmed"]},
        {"title": "Collect Case Study", "phase": "Month 4 & Renewal", "day_offset": 118, "assignee_role": "account_manager", "sop_reference": "SOP 26 — Testimonial & Case Study", "checklist": ["Client profile + problem", "Solution summary", "Results with numbers", "Client quote", "Video testimonial"]},
        {"title": "Offboarding (if not renewing)", "phase": "Month 4 & Renewal", "day_offset": 120, "assignee_role": "account_manager", "sop_reference": "SOP 25 — Client Offboarding", "checklist": ["Deliver final performance summary", "Transfer Meta ad account assets", "Transfer GHL sub-account", "Export all lead data to client", "Remove RRM partner access", "Conduct exit interview (5 questions)", "Request testimonial/referral", "Schedule 30/60/90-day nurture check-ins", "Internal debrief: log churn reason"]},
    ]
}

# ── Campaign: Launch Meta Campaign ──
CAMPAIGN_LAUNCH_TEMPLATE = {
    "id": "rrm-campaign-launch-v1", "is_global": True, "org_id": None,
    "name": "Launch Meta Campaign", "description": "Full campaign build from angle selection through go-live.",
    "offer_type": None, "type": "campaign", "trigger": None, "icon": "📣",
    "phases": ["Strategy", "Creative", "Build", "QA & Launch"],
    "tasks": [
        {"title": "Select campaign angle", "phase": "Strategy", "day_offset": 0, "sop_reference": "SOP 32 — Campaign Strategy Playbook", "checklist": ["Seller's Guide", "Free Home Eval", "Buyer's Guide", "Downsizing", "Upsizing", "Divorce", "Expired Listing", "Home Equity", "GST Rebate", "Investor", "Relocation", "Retargeting"]},
        {"title": "Write ad copy (3 variations)", "phase": "Creative", "day_offset": 1, "sop_reference": "SOP 06 — Ad Copy Templates", "checklist": ["Headline variation 1", "Headline variation 2", "Headline variation 3", "Body copy", "CTA", "CASL compliant"]},
        {"title": "Write VSL / thank-you page script", "phase": "Creative", "day_offset": 1, "sop_reference": "SOP 04 — Thank You Page VSL Scripts", "checklist": ["Select correct script angle", "Customize with agent name + market", "Send to client for filming"]},
        {"title": "Prepare 6+ creative assets", "phase": "Creative", "day_offset": 2, "sop_reference": "SOP 24 — Creative Refresh (70/20/10)", "checklist": ["6 angles minimum", "5 hooks per angle", "Static images", "Video creatives", "Brokerage logo on all"]},
        {"title": "Build landing page", "phase": "Build", "day_offset": 2, "sop_reference": "SOP 12 — Landing Page Build", "checklist": ["Hero + matching headline", "Value proposition", "Lead form", "Thank-you page with video + calendar", "Mobile-first", "Brokerage logo visible"]},
        {"title": "Build Meta campaign in Ads Manager", "phase": "Build", "day_offset": 3, "sop_reference": "SOP 11 — Meta Campaign Setup", "checklist": ["Leads objective", "Housing category ON", "4 ad sets × $7.50", "Higher Intent form", "Pixel events firing", "UTMs configured"]},
        {"title": "Configure GHL lead flow", "phase": "Build", "day_offset": 3, "checklist": ["Lead form → GHL webhook", "Speed-to-Lead SMS", "CRM pipeline stage", "ISA notified"]},
        {"title": "QA end-to-end", "phase": "QA & Launch", "day_offset": 4, "checklist": ["Submit test lead", "Confirm CRM entry", "Confirm SMS fires", "Confirm booking link works", "All ads approved"]},
        {"title": "Go live + monitor", "phase": "QA & Launch", "day_offset": 5, "checklist": ["Turn on campaign", "Monitor at 30 min", "Monitor at 4 hours", "Monitor at 24 hours", "Notify client"]},
    ]
}

# ── Funnel: Build VSL Funnel ──
VSL_FUNNEL_TEMPLATE = {
    "id": "rrm-vsl-funnel-v1", "is_global": True, "org_id": None,
    "name": "Build VSL Funnel", "description": "Script, build, and launch a video sales letter funnel end-to-end.",
    "offer_type": None, "type": "funnel", "trigger": None, "icon": "🎬",
    "phases": ["Script", "Assets", "Page Build", "Automation", "Launch"],
    "tasks": [
        {"title": "Write VSL script", "phase": "Script", "day_offset": 0, "sop_reference": "SOP 04 — Thank You Page VSL Scripts", "checklist": ["Hook (first 10 sec)", "Problem + agitation", "Solution reveal", "Proof/credibility", "Offer presentation", "CTA", "Under 90 seconds"]},
        {"title": "Film VSL", "phase": "Assets", "day_offset": 1, "checklist": ["Landscape mode", "Natural light", "Clean background", "Quiet room", "Speak naturally", "Upload to Drive"]},
        {"title": "Edit + caption video", "phase": "Assets", "day_offset": 2, "checklist": ["Trim start/end", "Add captions", "Add branding overlay", "Add CTA overlay", "Export MP4 under 50MB"]},
        {"title": "Build opt-in page", "phase": "Page Build", "day_offset": 2, "checklist": ["Headline matches ad promise", "Lead form", "Trust indicators", "Mobile-first"]},
        {"title": "Build thank-you / VSL page", "phase": "Page Build", "day_offset": 3, "checklist": ["VSL video embedded", "Calendar widget below", "CTA clear"]},
        {"title": "Set up automation sequence", "phase": "Automation", "day_offset": 3, "checklist": ["SMS confirmation", "Speed-to-Lead", "Email follow-up (Day 1, 3, 7)", "CRM pipeline stage"]},
        {"title": "Test + go live", "phase": "Launch", "day_offset": 4, "checklist": ["Submit test lead", "Watch full automation fire", "Confirm booking link", "Connect to ad traffic"]},
    ]
}

# ── Process: Monthly Creative Refresh ──
CREATIVE_REFRESH_TEMPLATE = {
    "id": "rrm-creative-refresh-v1", "is_global": True, "org_id": None,
    "name": "Monthly Creative Refresh", "description": "Audit, classify, and refresh ad creatives every 2-4 weeks.",
    "offer_type": None, "type": "process", "trigger": None, "icon": "🔄",
    "phases": ["Audit", "Classify", "Create", "Deploy"],
    "tasks": [
        {"title": "Pull performance data (last 14 days)", "phase": "Audit", "day_offset": 0, "sop_reference": "SOP 24 — Creative Refresh (70/20/10)", "checklist": ["CTR per creative", "CPL per creative", "Frequency (flag if >3.0)", "Hook hold rate", "Negative sentiment"]},
        {"title": "Classify all creatives", "phase": "Classify", "day_offset": 0, "checklist": ["🟢 Winner — scale", "🟡 Promising — test more", "🔴 Underperforming — pause", "⚫ Dead — archive"]},
        {"title": "Plan new creatives (70/20/10)", "phase": "Create", "day_offset": 1, "checklist": ["70% — winner variations", "20% — promising variations", "10% — new angles", "Minimum 6 new assets"]},
        {"title": "Write new ad copy", "phase": "Create", "day_offset": 1, "sop_reference": "SOP 06 — Ad Copy Templates"},
        {"title": "Produce creative assets", "phase": "Create", "day_offset": 2, "checklist": ["Static images (3+)", "Video creatives (2+)", "CASL-compliant"]},
        {"title": "Deploy + pause dead creatives", "phase": "Deploy", "day_offset": 3, "checklist": ["Upload to Ads Manager", "Add to correct ad sets", "Pause all Dead creatives", "Log changes", "Notify client"]},
    ]
}

# ── Internal: Warm Outreach Sprint ──
OUTREACH_SPRINT_TEMPLATE = {
    "id": "rrm-warm-outreach-v1", "is_global": True, "org_id": None,
    "name": "Warm Outreach Sprint (1 Week)", "description": "Daily outreach targeting Canadian realtors. 100 IG DMs + 20 LinkedIn DMs per day.",
    "offer_type": None, "type": "internal", "trigger": None, "icon": "📲",
    "phases": ["Setup", "Execution", "Review"],
    "tasks": [
        {"title": "Build prospect list (500+ minimum)", "phase": "Setup", "day_offset": 0, "sop_reference": "SOP 20 — Warm Outreach", "checklist": ["Realtor.ca + Instant Data Scraper", "ICP: Canadian agents, 10-30 deals/year", "Filter: active listings, local market", "Export to spreadsheet"]},
        {"title": "Prepare DM templates (IG + LinkedIn)", "phase": "Setup", "day_offset": 0, "checklist": ["IG DM: question-based, not pitch", "LinkedIn DM: professional tone", "Follow-up template ready", "Break-up message ready"]},
        {"title": "Day 1 outreach", "phase": "Execution", "day_offset": 1, "checklist": ["100 IG follow requests", "100 IG DMs to accepted follows", "20 LinkedIn connections", "20 LinkedIn DMs", "Replies logged", "Calls noted in CRM"]},
        {"title": "Day 2 outreach", "phase": "Execution", "day_offset": 2, "checklist": ["100 IG follow requests", "100 IG DMs", "20 LinkedIn connections", "20 LinkedIn DMs", "Replies logged"]},
        {"title": "Day 3 outreach", "phase": "Execution", "day_offset": 3, "checklist": ["100 IG follow requests", "100 IG DMs", "20 LinkedIn connections", "20 LinkedIn DMs", "Replies logged"]},
        {"title": "Day 4 outreach", "phase": "Execution", "day_offset": 4, "checklist": ["100 IG follow requests", "100 IG DMs", "20 LinkedIn connections", "20 LinkedIn DMs", "Replies logged"]},
        {"title": "Day 5 outreach", "phase": "Execution", "day_offset": 5, "checklist": ["100 IG follow requests", "100 IG DMs", "20 LinkedIn connections", "20 LinkedIn DMs", "Replies logged"]},
        {"title": "Sprint review", "phase": "Review", "day_offset": 6, "checklist": ["Total DMs sent", "Reply rate", "Calls booked", "Conversion to closed", "Adjust messaging"]},
    ]
}

# ── Internal: ISA Hire + Onboard ──
ISA_HIRE_TEMPLATE = {
    "id": "rrm-isa-hire-v1", "is_global": True, "org_id": None,
    "name": "Hire & Train ISA", "description": "Full hiring and training flow for an Inside Sales Agent via OnlineJobs.ph.",
    "offer_type": None, "type": "internal", "trigger": None, "icon": "🧑‍💼",
    "phases": ["Sourcing", "Interviews", "Hire", "Training", "Go Live"],
    "tasks": [
        {"title": "Post job on OnlineJobs.ph", "phase": "Sourcing", "day_offset": 0, "sop_reference": "SOP 28 — ISA Hiring & Training", "checklist": ["Title: Inside Sales Agent (Inbound Leads)", "NOT cold calling", "Rate: $4-8 USD/hr", "Required: excellent English, quiet workspace", "Include voice note test"]},
        {"title": "Review applications + voice notes", "phase": "Interviews", "day_offset": 3, "checklist": ["Filter by English clarity", "Filter by energy and tone", "Shortlist top 5"]},
        {"title": "Round 1: 15-min live call", "phase": "Interviews", "day_offset": 5, "checklist": ["Assess communication style", "Confirm availability (11AM-8PM EST)", "Confirm tech setup"]},
        {"title": "Round 2: Role play (10-min)", "phase": "Interviews", "day_offset": 6, "sop_reference": "SOP 08 — ISA Scripts", "checklist": ["Use buyer script", "Assess objection handling", "Score: tone, script adherence, confidence"]},
        {"title": "Extend offer + confirm start", "phase": "Hire", "day_offset": 7},
        {"title": "Training Day 1-2: Context + Systems", "phase": "Training", "day_offset": 8, "sop_reference": "SOP 08 — ISA Scripts & Workflow", "checklist": ["Walk through RRM offer + client journey", "GHL CRM walkthrough", "Pipeline stages explained", "Speed-to-Lead rule: 5 minutes"]},
        {"title": "Training Day 3-4: Script practice", "phase": "Training", "day_offset": 10, "checklist": ["Buyer script", "Seller script", "Voicemail script", "Objection handling", "Role play with team"]},
        {"title": "Training Day 5: Supervised live calls", "phase": "Training", "day_offset": 12, "checklist": ["Listen to 10 live calls", "Debrief after each", "Sign off on performance"]},
        {"title": "ISA go live independently", "phase": "Go Live", "day_offset": 14, "checklist": ["Daily schedule: 11AM-8PM EST", "Daily report format sent", "QA: review 5 random calls/week", "First week check-in booked"]},
    ]
}

ALL_TEMPLATES = [
    RRM_MEDIA_CLIENT_TEMPLATE,
    CAMPAIGN_LAUNCH_TEMPLATE,
    VSL_FUNNEL_TEMPLATE,
    CREATIVE_REFRESH_TEMPLATE,
    OUTREACH_SPRINT_TEMPLATE,
    ISA_HIRE_TEMPLATE,
]
