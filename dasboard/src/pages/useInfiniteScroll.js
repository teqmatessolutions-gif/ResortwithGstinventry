import { useEffect, useRef, useCallback } from 'react';

/**
 * A custom hook for implementing infinite scrolling.
 * Triggers immediately when scroll reaches the end with no delays for interactive feel.
 * @param {function} onIntersect - The callback function to execute when the trigger element is intersected.
 * @param {boolean} hasMore - A boolean indicating if there is more data to load.
 * @param {boolean} isLoading - A boolean indicating if data is currently being fetched.
 * @returns {React.RefObject} A ref to be attached to the trigger element.
 */
export const useInfiniteScroll = (onIntersect, hasMore, isLoading) => {
  const observerRef = useRef(null);
  const lastTriggeredRef = useRef(false);

  const intersectionCallback = useCallback((entries) => {
    const firstEntry = entries[0];
    // Trigger immediately when element becomes visible, no delays
    if (firstEntry.isIntersecting && hasMore && !isLoading && !lastTriggeredRef.current) {
      lastTriggeredRef.current = true;
      // Call the function immediately for instant loading
      onIntersect();
      // Reset trigger flag immediately after calling (async function will set isLoading)
      // This allows the next intersection to trigger once isLoading becomes false
      setTimeout(() => {
        lastTriggeredRef.current = false;
      }, 100); // Minimal delay just to prevent the same intersection event from firing twice
    } else if (!firstEntry.isIntersecting) {
      // Reset when element is no longer visible, allowing next scroll to trigger
      lastTriggeredRef.current = false;
    }
  }, [onIntersect, hasMore, isLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver(intersectionCallback, { 
      threshold: 0.01, // Trigger as soon as element starts to become visible
      rootMargin: '100px' // Start loading 100px before reaching the end for seamless experience
    });
    if (observerRef.current) {
      observer.observe(observerRef.current);
    }
    return () => observer.disconnect();
  }, [intersectionCallback]);

  // Reset trigger flag when isLoading changes to false (data loaded)
  useEffect(() => {
    if (!isLoading) {
      // Reset immediately when loading completes for instant next trigger
      lastTriggeredRef.current = false;
    }
  }, [isLoading]);

  return observerRef;
};