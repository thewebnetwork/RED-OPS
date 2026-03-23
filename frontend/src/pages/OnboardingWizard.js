import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ────────────────────────── helpers ────────────────────────── */
const headers = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

/* ────────────────────────── step configs ────────────────────── */
const STEPS = [
  { id: "welcome",  label: "Welcome",       icon: "👋" },
  { id: "profile",  label: "Your Profile",   icon: "👤" },
  { id: "team",     label: "Add Your Team",  icon: "👥" },
  { id: "client",   label: "First Client",   icon: "🏢" },
  { id: "project",  label: "First Project",  icon: "📋" },
  { id: "done",     label: "You're Set!",    icon: "🚀" },
];

/* ────────────────────────── main component ─────────────────── */
export default function OnboardingWizard() {
  const { user, updateUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Guard: redirect to login if not authenticated
  useEffect(() => {
    if (!user && !localStorage.getItem("token")) navigate("/login", { replace: true });
  }, [user, navigate]);

  // form data for each step
  const [profile, setProfile] = useState({ name: user?.name || "", phone: "", bio: "" });
  const [teamMembers, setTeamMembers] = useState([{ name: "", email: "", role: "Operator" }]);
  const [client, setClient] = useState({ name: "", email: "", company: "", phone: "" });
  const [project, setProject] = useState({ name: "", description: "" });

  // track what was actually created
  const [createdTeam, setCreatedTeam] = useState([]);
  const [createdClient, setCreatedClient] = useState(null);
  const [createdProject, setCreatedProject] = useState(null);

  useEffect(() => {
    if (user?.name) setProfile((p) => ({ ...p, name: user.name }));
  }, [user]);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  /* ────── navigation ────── */
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  /* ────── step handlers ────── */
  const saveProfile = async () => {
    setLoading(true);
    try {
      const update = {};
      if (profile.name && profile.name !== user?.name) update.name = profile.name;
      if (profile.phone) update.phone = profile.phone;
      if (profile.bio) update.bio = profile.bio;
      if (Object.keys(update).length > 0) {
        await axios.patch(`${API}/auth/profile`, update, headers());
        updateUser(update);
      }
      next();
    } catch (e) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const saveTeamMembers = async () => {
    const valid = teamMembers.filter((m) => m.name.trim() && m.email.trim());
    if (valid.length === 0) { next(); return; }
    setLoading(true);
    const created = [];
    for (const m of valid) {
      try {
        const res = await axios.post(`${API}/users`, {
          name: m.name.trim(),
          email: m.email.trim().toLowerCase(),
          password: "TempPass123!",
          role: m.role,
          account_type: "Internal Staff",
          force_password_change: true,
          force_otp_setup: false,
          send_welcome_email: true,
        }, headers());
        created.push(res.data);
      } catch (e) {
        const msg = e.response?.data?.detail || `Failed to add ${m.name}`;
        toast.error(msg);
      }
    }
    if (created.length > 0) {
      setCreatedTeam(created);
      toast.success(`Added ${created.length} team member${created.length > 1 ? "s" : ""}`);
    }
    setLoading(false);
    next();
  };

  const saveClient = async () => {
    if (!client.name.trim()) { next(); return; }
    setLoading(true);
    try {
      // Create as CRM contact
      const res = await axios.post(`${API}/crm/contacts`, {
        name: client.name.trim(),
        email: client.email.trim().toLowerCase() || undefined,
        company: client.company.trim() || undefined,
        phone: client.phone.trim() || undefined,
        status: "active",
      }, headers());
      setCreatedClient(res.data);
      toast.success(`Client "${client.name}" added`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to add client");
    }
    setLoading(false);
    next();
  };

  const saveProject = async () => {
    if (!project.name.trim()) { next(); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/projects`, {
        name: project.name.trim(),
        description: project.description.trim() || undefined,
        status: "active",
      }, headers());
      setCreatedProject(res.data);
      toast.success(`Project "${project.name}" created`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create project");
    }
    setLoading(false);
    next();
  };

  const finishOnboarding = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/auth/complete-onboarding`, {}, headers());
      await refreshUser();
      toast.success("Welcome to Red Ops!");
      navigate("/", { replace: true });
    } catch (e) {
      toast.error("Something went wrong");
    }
    setLoading(false);
  };

  const skipOnboarding = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/auth/complete-onboarding`, {}, headers());
      await refreshUser();
      navigate("/", { replace: true });
    } catch {
      navigate("/", { replace: true });
    }
  };

  /* ────── add / remove team member row ────── */
  const addMemberRow = () => setTeamMembers((t) => [...t, { name: "", email: "", role: "Operator" }]);
  const removeMemberRow = (i) => setTeamMembers((t) => t.filter((_, idx) => idx !== i));
  const updateMember = (i, field, val) =>
    setTeamMembers((t) => t.map((m, idx) => (idx === i ? { ...m, [field]: val } : m)));

  /* ────────────────────────── render ────────────────────────── */
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* ── progress bar ── */}
        <div style={styles.progressBar}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={styles.progressStep}>
              <div
                style={{
                  ...styles.dot,
                  background: i <= step ? "var(--accent)" : "var(--border)",
                  color: i <= step ? "#fff" : "var(--tx-3)",
                  transform: i === step ? "scale(1.2)" : "scale(1)",
                }}
              >
                {i < step ? "✓" : s.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    ...styles.connector,
                    background: i < step ? "var(--accent)" : "var(--border)",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── card ── */}
        <div style={styles.card}>
          {/* ────── STEP: WELCOME ────── */}
          {currentStep.id === "welcome" && (
            <div style={styles.stepContent}>
              <div style={styles.heroIcon}>🎉</div>
              <h1 style={styles.title}>Welcome to Red Ops</h1>
              <p style={styles.subtitle}>
                Your agency operations command center. Let's get you set up in under 2 minutes.
              </p>
              <div style={styles.featureGrid}>
                {[
                  { icon: "👥", title: "Team Management", desc: "Add your team and assign roles" },
                  { icon: "🏢", title: "Client Tracking", desc: "Manage your client relationships" },
                  { icon: "📋", title: "Project Boards", desc: "Track every deliverable" },
                  { icon: "📊", title: "Reports & Analytics", desc: "Real-time performance data" },
                ].map((f) => (
                  <div key={f.title} style={styles.featureCard}>
                    <span style={{ fontSize: 24 }}>{f.icon}</span>
                    <div>
                      <div style={styles.featureTitle}>{f.title}</div>
                      <div style={styles.featureDesc}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={styles.actions}>
                <button style={styles.primaryBtn} onClick={next}>
                  Let's Go →
                </button>
                <button style={styles.skipLink} onClick={skipOnboarding}>
                  Skip setup — I'll explore on my own
                </button>
              </div>
            </div>
          )}

          {/* ────── STEP: PROFILE ────── */}
          {currentStep.id === "profile" && (
            <div style={styles.stepContent}>
              <h2 style={styles.stepTitle}>Complete Your Profile</h2>
              <p style={styles.stepDesc}>Quick details so your team knows who's who.</p>
              <div style={styles.form}>
                <label style={styles.label}>
                  Full Name
                  <input
                    style={styles.input}
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Your full name"
                  />
                </label>
                <label style={styles.label}>
                  Phone (optional)
                  <input
                    style={styles.input}
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </label>
                <label style={styles.label}>
                  Bio (optional)
                  <textarea
                    style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="What you do at the company..."
                  />
                </label>
              </div>
              <div style={styles.actions}>
                <button style={styles.ghostBtn} onClick={prev}>← Back</button>
                <button style={styles.primaryBtn} onClick={saveProfile} disabled={loading}>
                  {loading ? "Saving..." : "Next →"}
                </button>
              </div>
            </div>
          )}

          {/* ────── STEP: TEAM ────── */}
          {currentStep.id === "team" && (
            <div style={styles.stepContent}>
              <h2 style={styles.stepTitle}>Add Your Team</h2>
              <p style={styles.stepDesc}>
                Invite people who'll use Red Ops. They'll get a temp password and set their own on first login.
              </p>
              <div style={styles.form}>
                {teamMembers.map((m, i) => (
                  <div key={i} style={styles.memberRow}>
                    <input
                      style={{ ...styles.input, flex: 1 }}
                      placeholder="Name"
                      value={m.name}
                      onChange={(e) => updateMember(i, "name", e.target.value)}
                    />
                    <input
                      style={{ ...styles.input, flex: 1 }}
                      placeholder="Email"
                      type="email"
                      value={m.email}
                      onChange={(e) => updateMember(i, "email", e.target.value)}
                    />
                    <select
                      style={{ ...styles.input, width: 140, flex: "none" }}
                      value={m.role}
                      onChange={(e) => updateMember(i, "role", e.target.value)}
                    >
                      <option value="Operator">Operator</option>
                      <option value="Standard User">Standard User</option>
                    </select>
                    {teamMembers.length > 1 && (
                      <button
                        style={styles.removeBtn}
                        onClick={() => removeMemberRow(i)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button style={styles.addRowBtn} onClick={addMemberRow}>
                  + Add another member
                </button>
              </div>
              <div style={styles.actions}>
                <button style={styles.ghostBtn} onClick={prev}>← Back</button>
                <div style={{ display: "flex", gap: 12 }}>
                  <button style={styles.ghostBtn} onClick={next}>Skip</button>
                  <button style={styles.primaryBtn} onClick={saveTeamMembers} disabled={loading}>
                    {loading ? "Adding..." : "Add & Continue →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ────── STEP: CLIENT ────── */}
          {currentStep.id === "client" && (
            <div style={styles.stepContent}>
              <h2 style={styles.stepTitle}>Add Your First Client</h2>
              <p style={styles.stepDesc}>
                Who's the first business you're working with? You can always add more later.
              </p>
              <div style={styles.form}>
                <label style={styles.label}>
                  Client / Company Name *
                  <input
                    style={styles.input}
                    value={client.name}
                    onChange={(e) => setClient({ ...client, name: e.target.value })}
                    placeholder="e.g. Acme Realty"
                  />
                </label>
                <div style={styles.twoCol}>
                  <label style={styles.label}>
                    Contact Email
                    <input
                      style={styles.input}
                      value={client.email}
                      onChange={(e) => setClient({ ...client, email: e.target.value })}
                      placeholder="contact@company.com"
                      type="email"
                    />
                  </label>
                  <label style={styles.label}>
                    Phone
                    <input
                      style={styles.input}
                      value={client.phone}
                      onChange={(e) => setClient({ ...client, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                    />
                  </label>
                </div>
                <label style={styles.label}>
                  Company
                  <input
                    style={styles.input}
                    value={client.company}
                    onChange={(e) => setClient({ ...client, company: e.target.value })}
                    placeholder="Legal business name (if different)"
                  />
                </label>
              </div>
              <div style={styles.actions}>
                <button style={styles.ghostBtn} onClick={prev}>← Back</button>
                <div style={{ display: "flex", gap: 12 }}>
                  <button style={styles.ghostBtn} onClick={next}>Skip</button>
                  <button style={styles.primaryBtn} onClick={saveClient} disabled={loading}>
                    {loading ? "Adding..." : "Add Client →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ────── STEP: PROJECT ────── */}
          {currentStep.id === "project" && (
            <div style={styles.stepContent}>
              <h2 style={styles.stepTitle}>Create Your First Project</h2>
              <p style={styles.stepDesc}>
                Projects organize tasks, deliverables, and timelines. Start with one.
              </p>
              <div style={styles.form}>
                <label style={styles.label}>
                  Project Name *
                  <input
                    style={styles.input}
                    value={project.name}
                    onChange={(e) => setProject({ ...project, name: e.target.value })}
                    placeholder="e.g. Website Redesign, Q2 Ad Campaign"
                  />
                </label>
                <label style={styles.label}>
                  Description (optional)
                  <textarea
                    style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
                    value={project.description}
                    onChange={(e) => setProject({ ...project, description: e.target.value })}
                    placeholder="Brief overview of what this project covers..."
                  />
                </label>
              </div>
              <div style={styles.actions}>
                <button style={styles.ghostBtn} onClick={prev}>← Back</button>
                <div style={{ display: "flex", gap: 12 }}>
                  <button style={styles.ghostBtn} onClick={next}>Skip</button>
                  <button style={styles.primaryBtn} onClick={saveProject} disabled={loading}>
                    {loading ? "Creating..." : "Create Project →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ────── STEP: DONE ────── */}
          {currentStep.id === "done" && (
            <div style={styles.stepContent}>
              <div style={styles.heroIcon}>🚀</div>
              <h2 style={styles.title}>You're All Set!</h2>
              <p style={styles.subtitle}>Here's what we set up for you:</p>
              <div style={styles.summaryList}>
                <div style={styles.summaryItem}>
                  <span style={styles.checkmark}>✓</span>
                  <span>Profile updated</span>
                </div>
                {createdTeam.length > 0 && (
                  <div style={styles.summaryItem}>
                    <span style={styles.checkmark}>✓</span>
                    <span>{createdTeam.length} team member{createdTeam.length > 1 ? "s" : ""} added</span>
                  </div>
                )}
                {createdClient && (
                  <div style={styles.summaryItem}>
                    <span style={styles.checkmark}>✓</span>
                    <span>Client "{createdClient.name || client.name}" added</span>
                  </div>
                )}
                {createdProject && (
                  <div style={styles.summaryItem}>
                    <span style={styles.checkmark}>✓</span>
                    <span>Project "{createdProject.name || project.name}" created</span>
                  </div>
                )}
                {createdTeam.length === 0 && !createdClient && !createdProject && (
                  <div style={styles.summaryItem}>
                    <span style={{ color: "var(--tx-3)" }}>—</span>
                    <span style={{ color: "var(--tx-3)" }}>You skipped the optional steps. No worries — you can add everything from the sidebar.</span>
                  </div>
                )}
              </div>
              <div style={styles.actions}>
                <button style={styles.primaryBtn} onClick={finishOnboarding} disabled={loading}>
                  {loading ? "Finishing..." : "Go to Dashboard →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── step counter ── */}
        <div style={styles.stepCounter}>
          Step {step + 1} of {STEPS.length}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── styles ────────────────────────── */
const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: {
    width: "100%",
    maxWidth: 680,
  },
  progressBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    gap: 0,
  },
  progressStep: {
    display: "flex",
    alignItems: "center",
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 600,
    transition: "all 0.3s ease",
    flexShrink: 0,
  },
  connector: {
    width: 40,
    height: 3,
    borderRadius: 2,
    transition: "background 0.3s ease",
  },
  card: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "40px 36px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
  },
  stepContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  heroIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "var(--tx-1)",
    margin: "0 0 8px",
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--tx-1)",
    margin: "0 0 4px",
  },
  subtitle: {
    fontSize: 16,
    color: "var(--tx-2)",
    margin: "0 0 28px",
    lineHeight: 1.5,
  },
  stepDesc: {
    fontSize: 15,
    color: "var(--tx-2)",
    margin: "0 0 24px",
    lineHeight: 1.5,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    width: "100%",
    marginBottom: 28,
    textAlign: "left",
  },
  featureCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    background: "var(--bg)",
    borderRadius: 10,
    border: "1px solid var(--border)",
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--tx-1)",
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    color: "var(--tx-3)",
  },
  form: {
    width: "100%",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    fontWeight: 500,
    color: "var(--tx-2)",
  },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--tx-1)",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
    width: "100%",
    boxSizing: "border-box",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  memberRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "var(--red)",
    cursor: "pointer",
    fontSize: 16,
    padding: "4px 8px",
    borderRadius: 6,
    flexShrink: 0,
  },
  addRowBtn: {
    background: "none",
    border: "1px dashed var(--border)",
    borderRadius: 8,
    padding: "10px 16px",
    color: "var(--accent)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
    textAlign: "center",
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 28,
    gap: 12,
  },
  primaryBtn: {
    padding: "12px 28px",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
  ghostBtn: {
    padding: "12px 20px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--tx-2)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  skipLink: {
    background: "none",
    border: "none",
    color: "var(--tx-3)",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
    marginTop: 8,
  },
  summaryList: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    textAlign: "left",
    margin: "12px 0 0",
  },
  summaryItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    background: "var(--bg)",
    borderRadius: 8,
    border: "1px solid var(--border)",
    fontSize: 15,
    color: "var(--tx-1)",
  },
  checkmark: {
    color: "var(--green)",
    fontWeight: 700,
    fontSize: 18,
  },
  stepCounter: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 13,
    color: "var(--tx-3)",
  },
};
