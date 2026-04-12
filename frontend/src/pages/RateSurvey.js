import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Star, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RateSurvey() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      return;
    }
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const res = await axios.get(`${API}/ratings/verify-token?token=${token}`);
      setTokenValid(res.data.valid);
      setOrderData(res.data);
    } catch (error) {
      setTokenValid(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/ratings`, {
        token,
        rating,
        comment: comment.trim() || null
      });
      setSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (interactive = false) => {
    const displayRating = interactive ? (hoveredRating || rating) : rating;
    
    return (
      <div className="flex gap-1 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setRating(star)}
            onMouseEnter={() => interactive && setHoveredRating(star)}
            onMouseLeave={() => interactive && setHoveredRating(0)}
            className={`transition-transform ${interactive ? 'hover:scale-110 cursor-pointer' : ''}`}
          >
            <Star
              size={48}
              className={`transition-colors ${
                star <= displayRating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-200 text-gray-200'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const getRatingText = () => {
    const texts = {
      1: 'Poor',
      2: 'Fair',
      3: 'Good',
      4: 'Very Good',
      5: 'Excellent!'
    };
    return texts[hoveredRating || rating] || 'Select your rating';
  };

  // Loading
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-[var(--accent)] text-white p-6 text-center">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="font-bold text-xl">RR</span>
            </div>
            <h1 className="text-xl font-bold">Red Ribbon Ops Portal</h1>
          </div>

          <div className="p-6">
            {/* Invalid Token */}
            {(!token || !tokenValid) && !submitted && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle size={32} className="text-red-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Invalid Survey Link</h2>
                <p className="mb-6">
                  This survey link is invalid or has already been completed.
                </p>
                <Link to="/login">
                  <Button variant="outline">
                    <ArrowLeft size={18} className="mr-2" />
                    Go to Portal
                  </Button>
                </Link>
              </div>
            )}

            {/* Success State */}
            {submitted && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Thank You!</h2>
                <p className="mb-4">
                  Your feedback has been submitted successfully.
                </p>
                <div className="mb-6">
                  {renderStars(false)}
                </div>
                <Link to="/login">
                  <Button className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]">
                    Go to Portal
                  </Button>
                </Link>
              </div>
            )}

            {/* Rating Form */}
            {token && tokenValid && !submitted && (
              <div className="py-4">
                {/* Resolver Info */}
                <div className="text-center mb-6">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 overflow-hidden">
                    {orderData?.resolver_avatar ? (
                      <img src={orderData.resolver_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold">
                        {orderData?.resolver_name?.charAt(0) || '?'}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-semibold">
                    How was {orderData?.resolver_name}?
                  </h2>
                  <p className="text-sm mt-1">
                    Order: {orderData?.order_code}
                  </p>
                  <p className="text-sm">
                    {orderData?.order_title}
                  </p>
                </div>

                {/* Star Rating - Google Review Style */}
                <div className="mb-6">
                  <div className="rounded-xl p-6">
                    {renderStars(true)}
                    <p className="text-center mt-3 text-lg font-medium">
                      {getRatingText()}
                    </p>
                  </div>
                </div>

                {/* Comment */}
                <div className="mb-6">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your experience (optional)"
                    rows={3}
                    className="resize-none"
                    data-testid="rating-comment"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || rating === 0}
                  className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
                  data-testid="submit-rating-btn"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    'Submit Rating'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-4">
          Your feedback helps maintain quality service
        </p>
      </div>
    </div>
  );
}
