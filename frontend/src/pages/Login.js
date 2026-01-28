import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t('auth.email') + ' & ' + t('auth.password') + ' required');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success(t('auth.loginTitle') + '!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/assets/logos/login-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Language Switcher - Top Right */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#A2182C] shadow-lg mb-4 relative">
              <img 
                src="/assets/logos/logo-realty.jpg" 
                alt="Red Ops" 
                className="w-full h-full object-cover object-center scale-150"
              />
              {/* Pulse animation */}
              <span className="absolute inset-0 rounded-full animate-ping bg-[#A2182C]/20" style={{ animationDuration: '2s' }} />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-[#A2182C]">Red Ops</h1>
              <p className="text-sm text-slate-500 mt-1">{t('auth.loginSubtitle')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-slate-700">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email')}
                className="mt-1.5 border-slate-300 focus:border-[#A2182C] focus:ring-[#A2182C]"
                data-testid="login-email-input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700">{t('auth.password')}</Label>
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-[#A2182C] hover:text-[#97662D] hover:underline"
                  data-testid="forgot-password-link"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password')}
                  className="pr-10 border-slate-300 focus:border-[#A2182C] focus:ring-[#A2182C]"
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#A2182C] hover:bg-[#8a1526] text-white"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('auth.loggingIn')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn size={18} />
                  {t('auth.loginButton')}
                </span>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            {t('auth.noAccount')} {t('auth.contactAdmin')}
          </p>
        </div>
        
        {/* Powered by text */}
        <p className="text-center text-xs text-white/60 mt-4">
          Red Ops Platform
        </p>
      </div>
    </div>
  );
}
