import { useEffect, useRef, useState } from "react";
import "./scrollAnimation.css"; // Make sure to create this CSS file

export function ContainerScrollAnimation({ children, animation = "fadeIn", ...props }) {
  const ref = useRef();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Optionally disconnect after the first reveal:
          observer.unobserve(ref.current);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return (
    <div ref={ref} className={`scroll-animation ${isVisible ? animation : ""}`} {...props}>
      {children}
    </div>
  );
}
