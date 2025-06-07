import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import { useEffect, useRef } from 'react';

function App() {
  const mousePosition = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const location = useLocation();

  useEffect(() => {
  if (location.pathname !== '/') return;

  const triangles = document.querySelectorAll('.triangle');
  triangles.forEach((triangle) => {
    const rect = triangle.getBoundingClientRect();
    triangle.dataset.x = rect.left;
    triangle.dataset.y = rect.top;
  });

  const handleMouseMove = (e) => {
    mousePosition.current = { x: e.clientX - 20, y: e.clientY - 20 };
  };

  let animationFrameId;

  const animateTriangles = () => {
    triangles.forEach((triangle) => {
      const speed = parseFloat(triangle.dataset.speed || 1);
      let currentX = parseFloat(triangle.dataset.x);
      let currentY = parseFloat(triangle.dataset.y);
      const dx = (mousePosition.current.x - currentX) * speed * 0.02;
      const dy = (mousePosition.current.y - currentY) * speed * 0.02;

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        currentX += dx;
        currentY += dy;
        triangle.dataset.x = currentX;
        triangle.dataset.y = currentY;

        const angle = Math.atan2(
          mousePosition.current.y - currentY,
          mousePosition.current.x - currentX
        ) * (180 / Math.PI);

        triangle.style.left = `${currentX}px`;
        triangle.style.top = `${currentY}px`;
        triangle.style.transform = `rotate(${angle}deg)`;
        triangle.style.backgroundColor = `hsl(${(currentX + currentY) % 360}, 70%, 50%)`;
        triangle.style.opacity = `${0.5 + Math.random() * 0.5}`;
      }
    });

    animationFrameId = requestAnimationFrame(animateTriangles);
  };

  window.addEventListener('mousemove', handleMouseMove);
  animationFrameId = requestAnimationFrame(animateTriangles);

  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    cancelAnimationFrame(animationFrameId);
  };
}, [location.pathname]);


  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/home" element={<Home />} />
      <Route
        path="/"
        element={
          <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
            <h1
              style={{
                zIndex: 1,
                position: 'relative',
                textAlign: 'center',
                padding: '50px',
                fontSize: '3rem',
                color: '#4CAF50',
              }}
            >
              Welcome to Civitas App
            </h1>
            <p
              style={{
                zIndex: 1,
                position: 'relative',
                textAlign: 'center',
                fontSize: '1.5rem',
                color: 'white',
                fontWeight: 'bold',
              }}
            >
              Join the conversation and share your thoughts!
            </p>
            <div
              style={{
                zIndex: 1,
                position: 'relative',
                textAlign: 'center',
                marginTop: '20px',
              }}
            >
              <Link
                to="/login"
                style={{
                  textDecoration: 'none',
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  borderRadius: '5px',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  border: '2px solid white', // Add a border around the button
                  display: 'inline-block', // Ensure the box wraps tightly around the text
                }}
              >
                Get Started
              </Link>
            </div>
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="triangle"
                data-speed={Math.random() * 2 + 0.5} // Random speed for each triangle
                style={{
                  position: 'absolute', // ensures left/top work as intended
                  left: `${Math.random() * 100}vw`,
                  top: `${Math.random() * 100}vh`,
                  width: `${Math.random() * 20 + 10}px`, // Random size
                  height: `${Math.random() * 20 + 10}px`, // Random size
                  backgroundColor: 'hsl(0, 70%, 50%)', // Initial color
                  borderRadius: '50%',
                }}
              ></div>
            ))}
          </div>
        }
      />
    </Routes>
  );
}

export default App;
