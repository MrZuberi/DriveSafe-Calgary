import React, { useState, useEffect } from 'react';

const App = () => {
  const [AppComponent, setAppComponent] = useState(null);

  useEffect(() => {
    const loadApp = async () => {
      // More reliable mobile detection
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTouchDevice = 'ontouchstart' in window;
      const isSmallScreen = window.innerWidth <= 1024;
      
      // Consider it mobile if ANY of these conditions are true
      const isMobile = isMobileDevice || (isTouchDevice && isSmallScreen);
      
      // Debug logging
      console.log('Screen width:', window.innerWidth);
      console.log('Is mobile device:', isMobileDevice);
      console.log('Is touch device:', isTouchDevice);
      console.log('Is small screen:', isSmallScreen);
      console.log('Final is mobile:', isMobile);
      console.log('User agent:', navigator.userAgent);
      
      if (isMobile) {
        console.log('Loading mobile app...');
        const { default: MobileApp } = await import('./mobile/App');
        await import('./mobile/App.css');
        setAppComponent(() => MobileApp);
      } else {
        console.log('Loading desktop app...');
        const { default: DesktopApp } = await import('./DesktopApp'); 
        await import('./App.css');
        setAppComponent(() => DesktopApp);
      }
    };

    loadApp();
  }, []);

  if (!AppComponent) return <div>Loading...</div>;
  
  return <AppComponent />;
};

export default App;
