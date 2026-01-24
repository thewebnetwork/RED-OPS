import { Star } from 'lucide-react';

export default function RatingCard({ 
  averageRating = 0, 
  totalRatings = 0, 
  totalDelivered = 0,
  ratingDistribution = {},
  showDistribution = true,
  size = 'default' // 'default' or 'compact'
}) {
  const renderStars = (rating, starSize = 20) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.floor(rating);
          const partial = !filled && star === Math.ceil(rating) && rating % 1 !== 0;
          
          return (
            <Star
              key={star}
              size={starSize}
              className={`${
                filled
                  ? 'fill-yellow-400 text-yellow-400'
                  : partial
                  ? 'fill-yellow-400/50 text-yellow-400'
                  : 'fill-gray-200 text-gray-200'
              }`}
            />
          );
        })}
      </div>
    );
  };

  const maxDistribution = Math.max(...Object.values(ratingDistribution), 1);

  if (size === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {renderStars(averageRating, 16)}
        <span className="font-semibold text-slate-900">{averageRating.toFixed(1)}</span>
        <span className="text-sm text-slate-500">({totalRatings})</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6" data-testid="rating-card">
      {/* Main Rating Display - Google Style */}
      <div className="flex items-start gap-6">
        {/* Left: Big Number & Stars */}
        <div className="text-center">
          <div className="text-5xl font-bold text-slate-900">{averageRating.toFixed(1)}</div>
          <div className="mt-2">{renderStars(averageRating, 24)}</div>
          <div className="text-sm text-slate-500 mt-1">
            {totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}
          </div>
        </div>

        {/* Right: Distribution Bars */}
        {showDistribution && (
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = ratingDistribution[stars] || 0;
              const percentage = totalRatings > 0 ? (count / maxDistribution) * 100 : 0;
              
              return (
                <div key={stars} className="flex items-center gap-2 text-sm">
                  <span className="w-3 text-slate-600">{stars}</span>
                  <Star size={12} className="fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-slate-500 text-xs">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center gap-8">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{totalDelivered}</div>
          <div className="text-xs text-slate-500">Orders Delivered</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{totalRatings}</div>
          <div className="text-xs text-slate-500">Ratings Received</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">
            {totalRatings > 0 ? Math.round((totalRatings / totalDelivered) * 100) : 0}%
          </div>
          <div className="text-xs text-slate-500">Response Rate</div>
        </div>
      </div>
    </div>
  );
}
