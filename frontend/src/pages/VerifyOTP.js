import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { ShieldCheck, KeyRound } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VerifyOTP() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/auth/otp/verify-login`, {
        code: verificationCode,
        trust_device: trustDevice
      });
      
      // If trust device was selected, store the trust token
      if (trustDevice) {
        const trustExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
        localStorage.setItem('otp_trust_expiry', trustExpiry.toString());
        localStorage.setItem('otp_trusted_device', 'true');
      }
      
      // Mark OTP as verified for this session
      sessionStorage.setItem('otp_session_verified', 'true');
      updateUser({ otp_session_verified: true });
      
      toast.success('Verification successful!');
      
      // Navigate to intended destination or home
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-200">
      <Card className="w-full max-w-md shadow-xl" data-testid="verify-otp-page">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the verification code from your authenticator app to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp-code" className="flex items-center gap-2">
                <KeyRound size={16} />
                Verification Code
              </Label>
              <Input
                id="otp-code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl font-mono tracking-widest"
                maxLength={6}
                autoFocus
                data-testid="verify-otp-code-input"
              />
              <p className="text-xs text-slate-500 text-center">
                Open your authenticator app and enter the 6-digit code
              </p>
            </div>

            {/* Trust Device Option */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Checkbox
                id="trust-device"
                checked={trustDevice}
                onCheckedChange={setTrustDevice}
                className="mt-0.5"
                data-testid="verify-trust-device-checkbox"
              />
              <div>
                <Label htmlFor="trust-device" className="font-medium text-blue-900 cursor-pointer">
                  Trust this computer for 30 days
                </Label>
                <p className="text-xs text-blue-700 mt-1">
                  You won't be asked for a verification code on this device for 30 days.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-700"
              disabled={loading || verificationCode.length !== 6}
              data-testid="verify-otp-btn"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-500"
              onClick={handleLogout}
            >
              Use a Different Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
