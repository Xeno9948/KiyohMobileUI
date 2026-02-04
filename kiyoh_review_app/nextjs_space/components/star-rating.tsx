"use client";

import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
}

export default function StarRating({ rating, maxRating = 10, size = 16 }: StarRatingProps) {
  const normalizedRating = (rating ?? 0) / (maxRating / 5);
  const fullStars = Math.floor(normalizedRating);
  const hasHalf = normalizedRating % 1 >= 0.5;

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)]?.map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < fullStars ? "star-fill fill-current" : hasHalf && i === fullStars ? "star-fill fill-current opacity-50" : "star-empty"}
        />
      ))}
    </div>
  );
}