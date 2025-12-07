import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

const SplashScreen: React.FC = () => {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    // Load the brand logo animation (not loader)
    fetch('/brand/guild-logo-animation.json')
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error('Failed to load animation:', err));
  }, []);

  if (!animationData) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-64 h-64 flex items-center justify-center">
          <div className="animate-pulse">
            <img
              src="/brand/guild-logo.png"
              alt="GUILD"
              className="w-48 h-48 object-contain"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="w-80 h-80">
        <Lottie
          animationData={animationData}
          loop={true}
          autoplay={true}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

export default SplashScreen;
