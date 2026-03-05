/**
 * Red Ribbon Media - Canonical Service Registry
 * 
 * Single source of truth for the 8 MVP services.
 * Used by:
 * - ServiceCatalog.js (display fallback)
 * - CommandCenter.js (category mapping)
 * 
 * Schema:
 * - id: unique service identifier (used in URLs)
 * - name: display name
 * - description: user-facing description
 * - icon: icon identifier (video, image, content, design, marketing, web)
 * - turnaround: estimated completion time
 * - included: whether it's included in base plans
 * - popular: whether to show "Popular" badge
 * - categoryId: exact L1 category UUID to preselect
 * - defaultTitle: auto-fill title in request form
 */

export const RRM_SERVICES = [
  {
    id: 'video-editing-60s',
    name: 'Video Editing (60s Reels)',
    description: 'Professional 60-second video editing for Instagram Reels, TikTok, and YouTube Shorts',
    icon: 'video',
    turnaround: '3-5 days',
    included: true,
    popular: true,
    categoryId: '128c2115-7437-4eb5-92f1-6fe8f1829f83', // Video Production
    defaultTitle: 'Video Editing - 60s Reels'
  },
  {
    id: 'short-form-stories',
    name: 'Short-Form Editing (Stories)',
    description: 'Instagram Stories and Snapchat content - quick edits optimized for vertical format',
    icon: 'video',
    turnaround: '1-2 days',
    included: true,
    popular: true,
    categoryId: '128c2115-7437-4eb5-92f1-6fe8f1829f83', // Video Production
    defaultTitle: 'Short-Form Video Editing - Stories'
  },
  {
    id: 'long-form-youtube',
    name: 'Long-Form Video (YouTube)',
    description: 'Complete YouTube video editing with intro, outro, b-roll, and transitions',
    icon: 'video',
    turnaround: '5-7 days',
    included: true,
    popular: true,
    categoryId: '128c2115-7437-4eb5-92f1-6fe8f1829f83', // Video Production
    defaultTitle: 'Long-Form Video Editing - YouTube'
  },
  {
    id: 'thumbnail-design',
    name: 'Thumbnail Design',
    description: 'Eye-catching YouTube thumbnails and social media preview images',
    icon: 'image',
    turnaround: '1-2 days',
    included: true,
    popular: false,
    categoryId: '07339517-4355-45c8-bcc5-9192695c9736', // Graphic Design
    defaultTitle: 'Thumbnail Design'
  },
  {
    id: 'content-writing',
    name: 'Content Writing',
    description: 'Blog posts, captions, scripts, and web copy tailored to your brand voice',
    icon: 'content',
    turnaround: '2-3 days',
    included: true,
    popular: false,
    categoryId: '966428f9-9472-411e-8391-86521c68e61b', // Copywriting & Content
    defaultTitle: 'Content Writing'
  },
  {
    id: 'social-media-graphics',
    name: 'Social Media Graphics',
    description: 'Custom graphics for Instagram, Facebook, LinkedIn, and Twitter posts',
    icon: 'design',
    turnaround: '2-4 days',
    included: true,
    popular: false,
    categoryId: '07339517-4355-45c8-bcc5-9192695c9736', // Graphic Design
    defaultTitle: 'Social Media Graphics'
  },
  {
    id: 'email-campaigns',
    name: 'Email Campaigns',
    description: 'Email newsletter design and copywriting for audience engagement',
    icon: 'marketing',
    turnaround: '2-3 days',
    included: false,
    popular: false,
    categoryId: 'ca56e986-fc8d-4dad-9e96-1712a9d084ee', // Email Marketing
    defaultTitle: 'Email Campaign'
  },
  {
    id: 'website-updates',
    name: 'Website Updates',
    description: 'Minor website updates, content changes, and page edits',
    icon: 'web',
    turnaround: '1-3 days',
    included: false,
    popular: false,
    categoryId: 'd098663c-d5bf-4c55-8d8c-0359d980761c', // CRM & Automations
    defaultTitle: 'Website Update'
  }
];

/**
 * Get service by ID
 * @param {string} serviceId
 * @returns {object|null} Service object or null if not found
 */
export const getServiceById = (serviceId) => {
  return RRM_SERVICES.find(s => s.id === serviceId) || null;
};

/**
 * Get all popular services
 * @returns {array} Array of popular services
 */
export const getPopularServices = () => {
  return RRM_SERVICES.filter(s => s.popular);
};

/**
 * Get all included services
 * @returns {array} Array of included services
 */
export const getIncludedServices = () => {
  return RRM_SERVICES.filter(s => s.included);
};
