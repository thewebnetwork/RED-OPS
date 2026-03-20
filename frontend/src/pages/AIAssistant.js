import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Send,
  Sparkles,
  Zap,
  FileText,
  BarChart2,
  MessageSquare,
  Plus,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  ChevronDown
} from 'lucide-react';
;

const suggestedPrompts = [
  'Generate a creative brief for a real estate agent',
  'What are best practices for Meta ad targeting?',
  'Create a monthly performance report template',
  'How do I set up GHL pipeline tracking?'
];

const mockBrief = `# Creative Brief

## Campaign Overview
**Objective:** Drive qualified leads for [Service]
**Target Budget:** $[Amount]/month
**Timeline:** [Start Date] - [End Date]

## Target Audience
- **Primary:** [Description]
- **Secondary:** [Description]
- **Interests:** [Relevant interests]

## Key Messages
1. **Primary Message:** [Main value proposition]
2. **Secondary:** [Supporting point]
3. **CTA:** [Call to action]

## Creative Specifications
- **Formats:** Static images, carousel, video
- **Visual Style:** [Professional/Modern/Bold]
- **Tone:** [Friendly/Professional/Authoritative]

## Success Metrics
- Cost per Lead: $[Target]
- Lead Quality Score: [Target]
- Click-through Rate: [Target]%`;

const mockReport = `# Monthly Performance Report

## Executive Summary
This month delivered [X%] increase in leads with improved cost efficiency. Conversion rates improved across all channels.

## Key Metrics
| Metric | This Month | Last Month | Change |
|--------|-----------|-----------|--------|
| Total Leads | 127 | 98 | +29.6% |
| Cost per Lead | $45 | $52 | -13.5% |
| Lead Quality | 8.2/10 | 7.6/10 | +0.6 |
| Conv. Rate | 12.5% | 10.1% | +2.4% |

## Channel Performance
- **Meta Ads:** 45 leads, $42 CPC, 92% quality
- **Google Ads:** 35 leads, $48 CPC, 85% quality
- **Organic:** 28 leads, $0 CPC, 88% quality
- **Referral:** 19 leads, $0 CPC, 94% quality

## Recommendations
1. Increase budget to top-performing audiences by 15%
2. Test new creative angles on underperforming segments
3. Implement lead scoring to focus on quality over quantity`;

const mockStatus = `# Client Status Summary

## Overview
Client is tracking well against Q1 objectives with strong momentum in lead generation.

## Recent Activity
- **Last Campaign:** Meta ads (past 7 days)
- **Performance:** 34 leads, $44 average cost
- **Quality:** 89% meet ICP criteria
- **Conversions:** 4 sales closed this month

## Current Status: ACTIVE & GROWING
- Monthly lead target: On track (127/130)
- Revenue impact: +$18,500 this month
- Team engagement: Excellent (daily optimization)

## Next Steps
- Launch new audience segment testing (Week of March 24)
- Monthly check-in call: March 28
- Budget optimization review: April 2`;

export default function AIAssistant() {
  const location = useLocation();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: "Hi! I'm your Red Ops AI assistant. I can help you generate creative briefs, summarize client status, write reports, and search your SOPs. What do you need?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Check for mode parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'brief') {
      setInput('Generate a creative brief for: ');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [location]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleQuickAction = (prompt) => {
    setInput(prompt);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    setLoading(true);

    // Try API call first
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      const response = await axios.post(
        `${backendUrl}/api/ai/chat`,
        { message: userMessage },
        { timeout: 10000 }
      );

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'ai',
        content: response.data.response || response.data.message,
        timestamp: new Date()
      }]);
    } catch (error) {
      // Fallback to mock responses
      let aiResponse = "I'm still learning! For now, I can help with creative briefs, client status summaries, and monthly reports. Try asking me to generate a brief.";

      if (userMessage.toLowerCase().includes('brief')) {
        aiResponse = mockBrief;
      } else if (userMessage.toLowerCase().includes('report')) {
        aiResponse = mockReport;
      } else if (userMessage.toLowerCase().includes('client') || userMessage.toLowerCase().includes('status')) {
        aiResponse = mockStatus;
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (content, id) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatContent = (content) => {
    // Simple markdown-like formatting for display
    return content.split('\n').map((line, i) => {
      if (line.startsWith('# ')) {
        return <h2 key={i} style={{ fontSize: '18px', fontWeight: '700', margin: '16px 0 8px 0', color: 'var(--tx-1)' }}>{line.substring(2)}</h2>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={i} style={{ fontSize: '15px', fontWeight: '600', margin: '12px 0 6px 0', color: 'var(--tx-1)' }}>{line.substring(3)}</h3>;
      }
      if (line.startsWith('- ')) {
        return <li key={i} style={{ marginLeft: '20px', marginBottom: '4px' }}>{line.substring(2)}</li>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} style={{ fontWeight: '600', margin: '8px 0', color: 'var(--tx-1)' }}>{line.slice(2, -2)}</p>;
      }
      if (line.trim() === '') {
        return <div key={i} style={{ height: '8px' }} />;
      }
      return <p key={i} style={{ margin: '4px 0', color: 'var(--tx-1)', lineHeight: '1.5' }}>{line}</p>;
    });
  };

  return (
    <div className="page-fill" style={{ display: 'flex', gap: '0' }}>
      {/* Chat Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                gap: '12px'
              }}
            >
              {msg.type === 'ai' && (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sparkles size={18} />
                </div>
              )}
              <div style={{
                maxWidth: msg.type === 'user' ? '70%' : '80%',
                padding: '12px 16px',
                borderRadius: '8px',
                background: msg.type === 'user' ? 'rgba(201, 42, 62, 0.2)' : 'var(--bg-card)',
                border: msg.type === 'user' ? '1px solid rgba(201, 42, 62, 0.3)' : `1px solid var(--border)`,
                color: 'var(--tx-1)',
                fontSize: '14px',
                lineHeight: '1.5',
                position: 'relative',
                wordWrap: 'break-word'
              }}>
                {msg.type === 'ai' ? (
                  <div style={{ fontSize: '13px' }}>
                    {formatContent(msg.content)}
                  </div>
                ) : (
                  msg.content
                )}

                {msg.type === 'ai' && (
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: `1px solid var(--border)`
                  }}>
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        color: copiedId === msg.id ? 'var(--green)' : 'var(--tx-3)',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'color 0.2s'
                      }}
                      title="Copy to clipboard"
                    >
                      <Copy size={14} />
                      {copiedId === msg.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        color: 'var(--tx-3)',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Helpful"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        color: 'var(--tx-3)',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Not helpful"
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'var(--blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: `1px solid var(--border)`,
                color: 'var(--tx-2)'
              }}>
                <span style={{ display: 'inline-flex', gap: '4px' }}>
                  <span style={{ animation: 'pulse 1s infinite' }}>.</span>
                  <span style={{ animation: 'pulse 1s infinite 0.2s' }}>.</span>
                  <span style={{ animation: 'pulse 1s infinite 0.4s' }}>.</span>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '20px',
          borderTop: `1px solid var(--border)`,
          background: 'var(--bg-card)'
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask me anything... (Shift+Enter for new line)"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '6px',
                background: 'var(--bg)',
                border: `1px solid var(--border)`,
                color: 'var(--tx-1)',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'none',
                minHeight: '44px',
                maxHeight: '120px'
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || loading}
              className="btn-primary"
              style={{
                padding: '12px',
                minWidth: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !input.trim() || loading ? 0.5 : 1,
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer'
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div style={{
        width: '280px',
        borderLeft: `1px solid var(--border)`,
        background: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}>
        {/* Quick Actions */}
        <div style={{ padding: '20px', borderBottom: `1px solid var(--border)` }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--tx-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px'
          }}>
            Quick Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => handleQuickAction('Generate a creative brief for: ')}
              className="btn-ghost"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: '13px',
                padding: '10px'
              }}
            >
              <FileText size={16} style={{ marginRight: '8px' }} />
              AI Brief Generator
            </button>
            <button
              onClick={() => handleQuickAction('Create a monthly performance report for my client')}
              className="btn-ghost"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: '13px',
                padding: '10px'
              }}
            >
              <BarChart2 size={16} style={{ marginRight: '8px' }} />
              Monthly Report
            </button>
            <button
              onClick={() => handleQuickAction('What is the status on client: ')}
              className="btn-ghost"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: '13px',
                padding: '10px'
              }}
            >
              <MessageSquare size={16} style={{ marginRight: '8px' }} />
              Status Summary
            </button>
            <button
              onClick={() => handleQuickAction('Check deadline risks for my active projects')}
              className="btn-ghost"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                fontSize: '13px',
                padding: '10px'
              }}
            >
              <Zap size={16} style={{ marginRight: '8px' }} />
              Deadline Risk Check
            </button>
          </div>
        </div>

        {/* Suggested Prompts */}
        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--tx-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px'
          }}>
            Suggested Prompts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(prompt)}
                style={{
                  padding: '10px',
                  background: 'var(--bg)',
                  border: `1px solid var(--border)`,
                  borderRadius: '6px',
                  color: 'var(--tx-2)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  lineHeight: '1.4'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.color = 'var(--tx-1)';
                  e.currentTarget.style.borderColor = 'var(--border-hi)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg)';
                  e.currentTarget.style.color = 'var(--tx-2)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
