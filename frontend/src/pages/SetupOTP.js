import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { Smartphone, ShieldCheck, KeyRound, RefreshCw, Copy } from 'lucide-react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SetupOTP() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);
  const [otpSecret, setOtpSecret] = useState('');
  const [otpUri, setOtpUri] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);

  useEffect(() => {
    // Get OTP setup data from backend
    const fetchOTPSetup = async () => {
      try {
        const res = await axios.get(`${API}/auth/otp/setup`);
        setOtpSecret(res.data.secret);
        setOtpUri(res.data.uri);
      } catch (error) {
        toast.error('Failed to generate OTP setup');
      } finally {
        setSetupLoading(false);
      }
    };
    fetchOTPSetup();
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/auth/otp/verify`, {
        code: verificationCode,
        trust_device: trustDevice
      });
      
      // Update user state
      updateUser({ otp_verified: true, force_otp_setup: false });
      
      // If trust device was selected, store the trust token in localStorage
      if (trustDevice) {
        const trustExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
        localStorage.setItem('otp_trust_expiry', trustExpiry.toString());
        localStorage.setItem('otp_trusted_device', 'true');
      }
      
      toast.success('Two-factor authentication enabled successfully!');
      navigate('/settings');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(otpSecret);
    toast.success('Secret key copied to clipboard');
  };

  const regenerateSecret = async () => {
    setSetupLoading(true);
    try {
      const res = await axios.get(`${API}/auth/otp/setup?regenerate=true`);
      setOtpSecret(res.data.secret);
      setOtpUri(res.data.uri);
      toast.success('New secret generated');
    } catch (error) {
      toast.error('Failed to regenerate secret');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (setupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="animate-spin h-10 w-10 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <Card className="w-full max-w-lg shadow-xl" data-testid="setup-otp-page">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Secure your account with an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: QR Code */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[var(--accent)] text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <Label className="text-base font-medium">Scan QR Code</Label>
            </div>
            <p className="text-sm ml-8">
              Open your authenticator app and scan this QR code:
            </p>
            <div className="flex justify-center p-4 bg-[#1e1e1e] rounded-lg border border-[#2a2a2a]">
              {otpUri && (
                <QRCodeSVG 
                  value={otpUri} 
                  size={180}
                  level="M"
                  includeMargin={true}
                />
              )}
            </div>
          </div>

          {/* Manual Entry */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#606060] text-white rounded-full flex items-center justify-center text-sm font-bold">
                <KeyRound size={14} />
              </div>
              <Label className="text-base font-medium">Or Enter Manually</Label>
            </div>
            <div className="flex items-center gap-2 ml-8">
              <Input 
                value={otpSecret} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={copySecret} title="Copy secret">
                <Copy size={16} />
              </Button>
              <Button variant="outline" size="icon" onClick={regenerateSecret} title="Generate new secret">
                <RefreshCw size={16} />
              </Button>
            </div>
          </div>

          {/* Step 2: Verify */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[var(--accent)] text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <Label className="text-base font-medium">Verify Setup</Label>
              </div>
              <p className="text-sm ml-8">
                Enter the 6-digit code from your authenticator app:
              </p>
              <div className="ml-8">
                <Input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                  data-testid="otp-code-input"
                />
              </div>
            </div>

            {/* Trust Device Option */}
            <div className="flex items-start gap-3 p-4 rounded-lg border">
              <Checkbox
                id="trust-device"
                checked={trustDevice}
                onCheckedChange={setTrustDevice}
                className="mt-0.5"
                data-testid="trust-device-checkbox"
              />
              <div>
                <Label htmlFor="trust-device" className="font-medium text-blue-900 cursor-pointer">
                  Trust this computer for 30 days
                </Label>
                <p className="text-xs mt-1">
                  You won't be asked for a verification code on this device for 30 days.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
              disabled={loading || verificationCode.length !== 6}
              data-testid="verify-otp-submit"
            >
              {loading ? (
                'Verifying...'
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck size={18} />
                  Enable Two-Factor Authentication
                </span>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleLogout}
            >
              Logout and Setup Later
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
