import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { 
  Plus, 
  Edit,
  Trash2,
  Users,
  UsersRound,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const colorOptions = [
  { value: '#DC2626', label: 'Red' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EAB308', label: 'Yellow' },
  { value: '#22C55E', label: 'Green' },
  { value: '#10B981', label: 'Emerald' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#8B5CF6', label: 'Violet' },
  { value: '#A855F7', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#78716C', label: 'Stone' },
];

export default function Teams() {
const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam.id);
    } else {
      setTeamMembers([]);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    try {
      const res = await axios.get(`${API}/teams`);
      setTeams(res.data);
      if (res.data.length > 0 && !selectedTeam) {
        setSelectedTeam(res.data[0]);
      }
    } catch (error) {
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId) => {
    setLoadingMembers(true);
    try {
      const res = await axios.get(`${API}/teams/${teamId}/members`);
      // API returns {team: {...}, members: [...]} - extract members array
      setTeamMembers(res.data.members || []);
    } catch (error) {
      console.error('Failed to load team members');
      setTeamMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const openDialog = (team = null) => {
    setEditingTeam(team);
    
    if (team) {
      setFormData({
        name: team.name,
        description: team.description || '',
        color: team.color || '#3B82F6'
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#3B82F6'
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Team name is required");
      return;
    }

    try {
      if (editingTeam) {
        await axios.patch(`${API}/teams/${editingTeam.id}`, formData);
        toast.success("Team updated");
      } else {
        await axios.post(`${API}/teams`, formData);
        toast.success("Team created");
      }
      fetchTeams();
      setDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save team");
    }
  };

  const handleDelete = async (teamId) => {
    toast('Delete this team? This cannot be undone.', {
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await axios.delete(`${API}/teams/${teamId}`);
            if (selectedTeam?.id === teamId) {
              setSelectedTeam(null);
            }
            fetchTeams();
            toast.success("Team deleted");
          } catch (error) {
            toast.error("Failed to delete team");
          }
        },
      },
      cancel: { label: 'Cancel' },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="teams-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{"Teams"}</h1>
          <p className="mt-1">{"Organize team members into groups"}</p>
        </div>
        <Button
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
          onClick={() => openDialog()}
          data-testid="add-team-btn"
        >
          <Plus size={18} className="mr-2" />
          {"Add Team"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <UsersRound size={20} className="text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teams.length}</p>
                <p className="text-sm">{"Total Teams"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <Users size={20} className="" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teams.reduce((acc, team) => acc + team.member_count, 0)}</p>
                <p className="text-sm">{"Total Members"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {teams.length > 0 ? Math.round(teams.reduce((acc, team) => acc + team.member_count, 0) / teams.length) : 0}
                </p>
                <p className="text-sm">{"Avg. Team Size"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams List */}
        <Card className="">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRound size={18} className="text-rose-600" />
              {"Teams"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {teams.length === 0 ? (
              <div className="p-6 text-center">
                {"No results"}
              </div>
            ) : (
              <div className="divide-y">
                {teams.map(team => (
                  <div 
                    key={team.id}
                    className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${
                      selectedTeam?.id === team.id ? 'border-l-2 border-rose-600' : ''
                    }`}
                    onClick={() => setSelectedTeam(team)}
                    data-testid={`team-item-${team.id}`}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${team.color}20` }}
                    >
                      <UsersRound size={18} style={{ color: team.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{team.name}</p>
                      <p className="text-xs">{team.member_count} {"Members"}</p>
                    </div>
                    <ChevronRight size={16} className="" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Details & Members */}
        <div className="lg:col-span-2 space-y-4">
          {selectedTeam ? (
            <>
              {/* Team Header */}
              <Card className="">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${selectedTeam.color}20` }}
                      >
                        <UsersRound size={28} style={{ color: selectedTeam.color }} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
                        {selectedTeam.description && (
                          <p className="text-sm mt-1">{selectedTeam.description}</p>
                        )}
                        <p className="text-sm mt-2">
                          <strong>{selectedTeam.member_count}</strong> {"Members"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog(selectedTeam)}
                      >
                        <Edit size={14} className="mr-1" />
                        {"Edit"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 border-red-200 hover:bg-red-50"
                        onClick={() => handleDelete(selectedTeam.id)}
                      >
                        <Trash2 size={14} className="mr-1" />
                        {"Delete"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Members */}
              <Card className="">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users size={18} className="text-rose-600" />
                    {"Members"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingMembers ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin h-6 w-6 border-3 border-rose-600 border-t-transparent rounded-full" />
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users size={32} className="mx-auto mb-2 text-slate-300" />
                      <p>{"No members"}</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {teamMembers.map(member => (
                        <div 
                          key={member.id}
                          className="flex items-center gap-3 p-4"
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
                            {member.avatar ? (
                              <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-medium">{member.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm">{member.email}</p>
                          </div>
                          <Badge className="">{member.role}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="">
              <CardContent className="p-12 text-center">
                <UsersRound size={48} className="mx-auto mb-4 text-slate-300" />
                <p>{"Select a team"}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? "Edit Team" : "New Team"}</DialogTitle>
            <DialogDescription>
              {editingTeam
                ? "Edit team information"
                : "Create a new team to organize members"
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{"Team Name"} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={"Team name"}
                className="mt-1.5"
                data-testid="team-name-input"
              />
            </div>

            <div>
              <Label>{"Description"}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={"Description"}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>{"Color"}</Label>
              <Select
                value={formData.color}
                onValueChange={(v) => setFormData(prev => ({ ...prev, color: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: opt.value }}
                        />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)]" data-testid="save-team-btn">
              {editingTeam ? "Save" : "Create"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
